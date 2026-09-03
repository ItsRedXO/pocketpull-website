export function buildSupportMessageScope(userId: string): { clause: string; params: string[] } {
  return {
    clause: 'chat_id IN (SELECT id FROM support_chats WHERE user_id=$1)',
    params: [userId],
  };
}
