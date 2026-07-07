import { Router, type IRouter } from "express";
import path from "path";
import { eq } from "drizzle-orm";
import { db, nimbleConversationsTable, nimbleMessagesTable } from "@workspace/db";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { getAllExcelData } from "../../lib/excel-parser.js";
import { parseDocxForecast } from "../../lib/docx-parser.js";
import { runRulesEngine, buildFinancialContext } from "../../lib/rules-engine.js";
import {
  CreateConversationBody,
  DeleteConversationParams,
  ListMessagesParams,
  SendMessageParams,
  SendMessageBody,
} from "@workspace/api-zod";

const router: IRouter = Router();

if (!process.env.GEMINI_API_KEY) {
  throw new Error("GEMINI_API_KEY environment variable is required");
}
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

function getDataDir(): string {
  const workspaceRoot = process.cwd().endsWith(path.join("artifacts", "api-server"))
    ? path.resolve(process.cwd(), "../..")
    : process.cwd();
  return path.resolve(workspaceRoot, "attached_assets");
}

function getDocxPath(): string {
  return path.resolve(getDataDir(), "RMS_Complete_Forecast_Report_1783420128541.docx");
}

const SYSTEM_PROMPT = `You are Nimble, an expert hotel financial analyst AI embedded in the Nimble Insights dashboard for Test Hospitality. You have access to the property's actual P&L data from Excel files, H2 2025 forecast targets from an RMS forecast report, and a rules engine that has already identified the most critical performance alerts.

Your role:
- Provide specific, actionable financial recommendations based on the actual data provided
- Be direct and concise — hotel operators are busy people
- Reference specific numbers from the context when making recommendations
- Prioritize revenue management, cost control, and profitability improvement
- When discussing forecasts, acknowledge the model accuracy findings (Prophet works best, 2-yr window outperforms 3-yr)
- Format responses clearly with bullet points or short paragraphs where helpful
- If data is limited, acknowledge it and provide industry-standard guidance

Do NOT:
- Make up numbers not in the context
- Give generic advice without referencing the specific data
- Be overly verbose — keep responses under 400 words unless the question requires detail
- Use excessive jargon without explanation

Always end complex analyses with a clear "Priority Action" line.`;

// GET /api/nimble/conversations
router.get("/nimble/conversations", async (req, res): Promise<void> => {
  const conversations = await db
    .select()
    .from(nimbleConversationsTable)
    .orderBy(nimbleConversationsTable.createdAt);
  res.json(conversations);
});

// POST /api/nimble/conversations
router.post("/nimble/conversations", async (req, res): Promise<void> => {
  const parsed = CreateConversationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const [conv] = await db
    .insert(nimbleConversationsTable)
    .values({
      title: parsed.data.title,
      year: parsed.data.year,
      month: parsed.data.month ?? null,
    })
    .returning();

  res.status(201).json(conv);
});

// DELETE /api/nimble/conversations/:id
router.delete("/nimble/conversations/:id", async (req, res): Promise<void> => {
  const params = DeleteConversationParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [conv] = await db
    .delete(nimbleConversationsTable)
    .where(eq(nimbleConversationsTable.id, id))
    .returning();

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  res.sendStatus(204);
});

// GET /api/nimble/conversations/:id/messages
router.get("/nimble/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = ListMessagesParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const messages = await db
    .select()
    .from(nimbleMessagesTable)
    .where(eq(nimbleMessagesTable.conversationId, id))
    .orderBy(nimbleMessagesTable.createdAt);

  res.json(messages);
});

// POST /api/nimble/conversations/:id/messages  (SSE streaming)
router.post("/nimble/conversations/:id/messages", async (req, res): Promise<void> => {
  const params = SendMessageParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const body = SendMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const conversationId = parseInt(raw, 10);

  // Verify conversation exists
  const [conv] = await db
    .select()
    .from(nimbleConversationsTable)
    .where(eq(nimbleConversationsTable.id, conversationId));

  if (!conv) {
    res.status(404).json({ error: "Conversation not found" });
    return;
  }

  const targetYear = body.data.year ?? conv.year ?? 2025;
  const targetMonth = body.data.month ?? conv.month ?? undefined;

  // Save user message
  await db.insert(nimbleMessagesTable).values({
    conversationId,
    role: "user",
    content: body.data.content,
  });

  // Load all prior messages for context
  const priorMessages = await db
    .select()
    .from(nimbleMessagesTable)
    .where(eq(nimbleMessagesTable.conversationId, conversationId))
    .orderBy(nimbleMessagesTable.createdAt);

  // Build financial context
  const allData = getAllExcelData(getDataDir());
  const forecast = await parseDocxForecast(getDocxPath());
  const alerts = runRulesEngine(allData, forecast, targetYear, targetMonth);
  const financialContext = buildFinancialContext(allData, forecast, alerts, targetYear, targetMonth);

  // Build Gemini message history
  const systemWithContext = `${SYSTEM_PROMPT}\n\n${financialContext}`;

  const chatHistory = priorMessages
    .slice(0, -1) // exclude the message we just inserted (the current user message)
    .map(m => ({
      role: m.role === "assistant" ? "model" as const : "user" as const,
      parts: [{ text: m.content }],
    }));

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.flushHeaders();

  let fullResponse = "";

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction: systemWithContext,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
      },
    });

    const chat = model.startChat({ history: chatHistory });
    const stream = await chat.sendMessageStream(body.data.content);

    for await (const chunk of stream.stream) {
      const text = chunk.text();
      if (text) {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      }
    }

    // Save assistant response
    await db.insert(nimbleMessagesTable).values({
      conversationId,
      role: "assistant",
      content: fullResponse,
    });

    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "AI error";
    res.write(`data: ${JSON.stringify({ error: msg })}\n\n`);
  }

  res.end();
});

export default router;
