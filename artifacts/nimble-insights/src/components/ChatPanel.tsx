import { useState, useRef, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListConversations,
  useCreateConversation,
  useListMessages,
  getListConversationsQueryKey,
  getListMessagesQueryKey,
} from "@workspace/api-client-react";
import { Send, Plus, Trash2, MessageSquare, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ChatPanelProps {
  year: number;
  month: number | null;
  compact?: boolean;
}

const QUICK_ACTIONS = [
  "Analyze revenue performance",
  "What's driving GOP variance?",
  "How does occupancy compare to forecast?",
  "Top cost reduction opportunities",
  "Explain the forecasting model accuracy",
  "What should we prioritize this month?",
];

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="bg-white/10 px-1 rounded text-xs font-mono">$1</code>')
    .replace(/^### (.+)$/gm, '<h3 class="text-sm font-semibold text-white mt-3 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-sm font-semibold text-white mt-3 mb-1">$1</h2>')
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc">$1</li>')
    .replace(/(<li.*<\/li>\n?)+/g, '<ul class="my-1 space-y-0.5">$&</ul>')
    .replace(/\n\n/g, '</p><p class="mt-2">')
    .replace(/\n/g, '<br/>');
}

export default function ChatPanel({ year, month, compact = false }: ChatPanelProps) {
  const queryClient = useQueryClient();
  const [activeConvId, setActiveConvId] = useState<number | null>(null);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showConvList, setShowConvList] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { data: conversations, isLoading: convsLoading } = useListConversations();
  const createConv = useCreateConversation();
  const { data: messages, isLoading: msgsLoading } = useListMessages(activeConvId!, {
    query: { enabled: !!activeConvId, queryKey: getListMessagesQueryKey(activeConvId!) },
  });

  // Auto-create or select conversation on load
  useEffect(() => {
    if (!conversations) return;
    if (conversations.length > 0 && !activeConvId) {
      setActiveConvId(conversations[conversations.length - 1].id);
    } else if (conversations.length === 0 && !createConv.isPending) {
      createConv.mutate(
        { data: { title: `Financial Analysis ${year}`, year, month: month ?? undefined } },
        {
          onSuccess: (conv) => {
            queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
            setActiveConvId(conv.id);
          },
        }
      );
    }
  }, [conversations]);

  // Scroll to bottom when messages change or streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const sendMessage = useCallback(async (content: string) => {
    if (!content.trim() || !activeConvId || streaming) return;
    setInput("");
    setStreaming(true);
    setStreamingContent("");

    // Optimistically show user message by refetching
    await queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(activeConvId) });

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const response = await fetch(`/api/nimble/conversations/${activeConvId}/messages`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, year, month }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error("Request failed");
      }

      // Refetch to show user message
      await queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(activeConvId) });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let full = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.content) {
                full += data.content;
                setStreamingContent(full);
              }
              if (data.done || data.error) {
                setStreaming(false);
                setStreamingContent("");
                queryClient.invalidateQueries({ queryKey: getListMessagesQueryKey(activeConvId) });
              }
            } catch {}
          }
        }
      }
    } catch (e: unknown) {
      if (e instanceof Error && e.name !== "AbortError") {
        setStreamingContent("Sorry, something went wrong. Please try again.");
      }
    } finally {
      setStreaming(false);
    }
  }, [activeConvId, streaming, year, month, queryClient]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleNewConversation = () => {
    createConv.mutate(
      { data: { title: `Analysis ${new Date().toLocaleDateString()}`, year, month: month ?? undefined } },
      {
        onSuccess: (conv) => {
          queryClient.invalidateQueries({ queryKey: getListConversationsQueryKey() });
          setActiveConvId(conv.id);
          setShowConvList(false);
        },
      }
    );
  };

  const activeConv = conversations?.find((c) => c.id === activeConvId);

  return (
    <div className="flex flex-col h-full bg-[hsl(222,44%,9%)] rounded-xl border border-[hsl(216,28%,16%)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[hsl(216,28%,16%)] shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-xs font-bold text-white shrink-0">N</div>
          <div className="relative">
            <button
              onClick={() => setShowConvList(!showConvList)}
              className="flex items-center gap-1 text-sm font-medium text-white hover:text-indigo-300 transition-colors"
              data-testid="button-conversation-select"
            >
              <span className="max-w-[160px] truncate">{activeConv?.title ?? "Nimble AI Analyst"}</span>
              <ChevronDown className="w-3.5 h-3.5 shrink-0" />
            </button>
            {showConvList && (
              <div className="absolute top-full left-0 mt-1 w-64 bg-[hsl(222,44%,12%)] border border-[hsl(216,28%,20%)] rounded-lg shadow-xl z-50 overflow-hidden">
                <div className="p-1">
                  {conversations?.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => { setActiveConvId(c.id); setShowConvList(false); }}
                      className={`w-full text-left px-3 py-2 rounded-md text-xs transition-colors flex items-center gap-2 ${c.id === activeConvId ? "bg-indigo-600/20 text-indigo-300" : "hover:bg-white/5 text-[hsl(215,20%,65%)]"}`}
                      data-testid={`button-conversation-${c.id}`}
                    >
                      <MessageSquare className="w-3 h-3 shrink-0" />
                      <span className="truncate">{c.title}</span>
                    </button>
                  ))}
                </div>
                <div className="border-t border-[hsl(216,28%,20%)] p-1">
                  <button
                    onClick={handleNewConversation}
                    className="w-full text-left px-3 py-2 rounded-md text-xs text-indigo-400 hover:bg-indigo-600/10 flex items-center gap-2 transition-colors"
                    data-testid="button-new-conversation"
                  >
                    <Plus className="w-3 h-3" /> New conversation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleNewConversation}
          className="h-7 w-7 p-0 text-[hsl(215,20%,55%)] hover:text-white"
          data-testid="button-new-chat"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto scrollbar-thin px-4 py-3 space-y-4 min-h-0">
        {msgsLoading || convsLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-3/4 bg-white/5" />
            ))}
          </div>
        ) : (!messages || messages.length === 0) && !streaming ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center mb-3">
              <MessageSquare className="w-5 h-5 text-indigo-400" />
            </div>
            <p className="text-sm font-medium text-white mb-1">Ask Nimble anything</p>
            <p className="text-xs text-[hsl(215,20%,45%)]">Your AI hotel financial analyst</p>
          </div>
        ) : (
          <>
            {messages?.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-2.5 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                data-testid={`message-${msg.id}`}
              >
                {msg.role === "assistant" && (
                  <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">N</div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-xs leading-relaxed ${
                    msg.role === "user"
                      ? "bg-indigo-600/80 text-white rounded-tr-sm"
                      : "bg-[hsl(222,44%,14%)] border border-[hsl(216,28%,20%)] text-[hsl(213,31%,86%)] rounded-tl-sm"
                  }`}
                >
                  {msg.role === "assistant" ? (
                    <div
                      className="prose prose-invert prose-xs max-w-none"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }}
                    />
                  ) : (
                    msg.content
                  )}
                </div>
                {msg.role === "user" && (
                  <div className="w-6 h-6 rounded-lg bg-[hsl(216,28%,22%)] flex items-center justify-center text-[10px] font-medium text-[hsl(215,20%,65%)] shrink-0 mt-0.5">U</div>
                )}
              </div>
            ))}

            {/* Streaming message */}
            {streaming && (
              <div className="flex gap-2.5 justify-start">
                <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0 mt-0.5">N</div>
                <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-[hsl(222,44%,14%)] border border-[hsl(216,28%,20%)] px-3.5 py-2.5">
                  {streamingContent ? (
                    <div
                      className="prose prose-invert prose-xs max-w-none text-xs text-[hsl(213,31%,86%)] leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(streamingContent) }}
                    />
                  ) : (
                    <div className="flex items-center gap-1 py-1">
                      <span className="typing-dot w-1.5 h-1.5 bg-indigo-400 rounded-full inline-block" />
                      <span className="typing-dot w-1.5 h-1.5 bg-indigo-400 rounded-full inline-block" />
                      <span className="typing-dot w-1.5 h-1.5 bg-indigo-400 rounded-full inline-block" />
                    </div>
                  )}
                </div>
              </div>
            )}
          </>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick actions */}
      {(!messages || messages.length === 0) && !streaming && !compact && (
        <div className="px-4 pb-2 shrink-0">
          <div className="flex flex-wrap gap-1.5">
            {QUICK_ACTIONS.slice(0, 4).map((action) => (
              <button
                key={action}
                onClick={() => sendMessage(action)}
                disabled={streaming}
                className="px-2.5 py-1 text-[10px] rounded-full bg-[hsl(216,28%,16%)] border border-[hsl(216,28%,22%)] text-[hsl(215,20%,65%)] hover:border-indigo-500/50 hover:text-indigo-300 transition-colors disabled:opacity-50"
                data-testid={`chip-${action.slice(0, 15).replace(/\s/g, "-")}`}
              >
                {action}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4 shrink-0">
        <div className="flex gap-2 items-end bg-[hsl(222,44%,13%)] border border-[hsl(216,28%,20%)] rounded-xl px-3 py-2 focus-within:border-indigo-500/50 transition-colors">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about revenue, costs, occupancy..."
            disabled={streaming}
            rows={1}
            className="flex-1 bg-transparent text-xs text-white placeholder:text-[hsl(215,20%,40%)] resize-none outline-none leading-relaxed disabled:opacity-50 min-h-[20px]"
            data-testid="input-chat-message"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || streaming || !activeConvId}
            className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            data-testid="button-send-message"
          >
            <Send className="w-3.5 h-3.5" />
          </button>
        </div>
        <p className="text-[10px] text-[hsl(215,20%,35%)] mt-1.5 text-center">
          Shift+Enter for new line · Enter to send
        </p>
      </div>
    </div>
  );
}
