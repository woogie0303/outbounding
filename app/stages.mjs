export const stages = ['미접촉','접촉 중','상담 진행','제안·협의','계약 완료','종료'];
export function readStage(id) {
  if (typeof window === 'undefined') return stages[0];
  try {
    const board = JSON.parse(localStorage.getItem('outbounding.board') || '{}');
    const stage = stages.find(value => Array.isArray(board[value]) && board[value].includes(id));
    if (stage) return stage;
    const legacy = JSON.parse(localStorage.getItem('outbounding.stages') || '{}')[id];
    return {'통화 완료':'접촉 중','후속 연락':'접촉 중','관심 없음':'종료'}[legacy] || (stages.includes(legacy) ? legacy : stages[0]);
  } catch { return stages[0]; }
}
