const { lineClient, LINE_CHANNEL_ACCESS_TOKEN, MEMBER_CHECK_CACHE_TTL_MS } = require("./config");
const { logInfo, logError } = require("./utils");

const memberCheckCache = new Map();

function getConversationBindingKey(event) {
  if (event.source?.type === "group" && event.source?.groupId) {
    return { sourceType: "group", conversationId: event.source.groupId };
  }
  if (event.source?.type === "room" && event.source?.roomId) {
    return { sourceType: "room", conversationId: event.source.roomId };
  }
  return null;
}

function getMemberCheckCacheKey(bindingKey, lineUserId) {
  if (!bindingKey?.conversationId || !lineUserId) return "";
  return `${bindingKey.sourceType}:${bindingKey.conversationId}:${lineUserId}`;
}

function clearMemberCheckCache(bindingKey, lineUserId) {
  const cacheKey = getMemberCheckCacheKey(bindingKey, lineUserId);
  if (cacheKey) memberCheckCache.delete(cacheKey);
}

async function isLineUserInConversation(bindingKey, lineUserId) {
  if (!bindingKey?.conversationId || !lineUserId) return true;
  const cacheKey = getMemberCheckCacheKey(bindingKey, lineUserId);
  const cached = memberCheckCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.exists;

  const sourcePath = bindingKey.sourceType === "room" ? "room" : "group";
  const url = `https://api.line.me/v2/bot/${sourcePath}/${encodeURIComponent(bindingKey.conversationId)}/member/${encodeURIComponent(lineUserId)}`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}` },
    });
    if (response.status === 200 || response.status === 404) {
      const exists = response.status === 200;
      memberCheckCache.set(cacheKey, { exists, expiresAt: Date.now() + MEMBER_CHECK_CACHE_TTL_MS });
      return exists;
    }
    const body = await response.text();
    logError("line_member_check_failed", {
      status: response.status, body: body.slice(0, 300),
      sourceType: bindingKey.sourceType, conversationId: bindingKey.conversationId,
      lineUserId, time: new Date().toISOString(),
    });
    return true;
  } catch (error) {
    logError("line_member_check_failed", {
      error: error.message, sourceType: bindingKey.sourceType,
      conversationId: bindingKey.conversationId, lineUserId, time: new Date().toISOString(),
    });
    return true;
  }
}

async function pushConversationText(bindingKey, text) {
  if (!bindingKey?.conversationId || !text) return false;
  try {
    const response = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        to: bindingKey.conversationId,
        messages: [{ type: "text", text }],
      }),
    });
    if (response.ok) return true;
    const body = await response.text();
    logError("line_push_failed", {
      status: response.status, body: body.slice(0, 300),
      sourceType: bindingKey.sourceType, conversationId: bindingKey.conversationId,
      time: new Date().toISOString(),
    });
    return false;
  } catch (error) {
    logError("line_push_failed", {
      error: error.message, sourceType: bindingKey.sourceType,
      conversationId: bindingKey.conversationId, time: new Date().toISOString(),
    });
    return false;
  }
}

function addOriginalQuote(event, messages) {
  const quoteToken = event.message?.quoteToken;
  if (!quoteToken || !Array.isArray(messages) || messages.length === 0) return messages;
  return messages.map((message, index) => {
    if (index !== 0 || message.type !== "text") return message;
    return { ...message, quoteToken };
  });
}

async function replyMessages(event, messages) {
  try {
    console.log("Replying:", {
      sourceType: event.source?.type,
      groupId: event.source?.groupId,
      roomId: event.source?.roomId,
      userId: event.source?.userId,
      messageCount: messages.length,
      time: new Date().toISOString(),
    });
    return await lineClient.replyMessage({ replyToken: event.replyToken, messages });
  } catch (error) {
    console.error("LINE reply failed:", {
      error: error.message, sourceType: event.source?.type,
      groupId: event.source?.groupId, roomId: event.source?.roomId,
      userId: event.source?.userId, time: new Date().toISOString(),
    });
    return null;
  }
}

async function reply(event, text) {
  return replyMessages(event, [{ type: "text", text }]);
}

async function replyWithNotices(event, text, notices = []) {
  return replyMessages(event, [...notices, { type: "text", text }]);
}

module.exports = {
  memberCheckCache,
  getConversationBindingKey,
  getMemberCheckCacheKey,
  clearMemberCheckCache,
  isLineUserInConversation,
  pushConversationText,
  addOriginalQuote,
  replyMessages,
  reply,
  replyWithNotices,
};
