import { create } from "zustand";

export const GAME_PHASES = {
  LOBBY: "LOBBY",
  CASE_SELECT: "CASE_SELECT",
  COURTROOM: "COURTROOM",
  VERDICT: "VERDICT",
};
export const TURN_STATES = {
  PETITIONER: "PETITIONER",
  RESPONDENT: "RESPONDENT",
  JUDGE: "JUDGE",
  END: "END",
};
export const CRITERIA = {
  legal_application: "Legal application",
  issue_relevance: "Issue relevance",
  argument_flow: "Argument flow",
  bench_handling: "Bench handling",
};
const emptyScore = () => ({
  total: null,
  history: [],
  ...Object.fromEntries(Object.keys(CRITERIA).map((k) => [k, null])),
});
const session = () => ({
  phase: GAME_PHASES.LOBBY,
  selectedCase: null,
  turnState: "PETITIONER",
  currentSpeaker: "petitioner",
  scores: { petitioner: emptyScore(), respondent: emptyScore() },
  transcript: [],
  judgeMessage: null,
  isJudgeSpeaking: false,
  isInterrupting: false,
  judgeInterruptContext: null,
  roundNumber: 1,
  maxRounds: 3,
  retryCountBySpeaker: { petitioner: 0, respondent: 0 },
  verdict: null,
  error: "",
  provider: "",
  drafts: { petitioner: "", respondent: "" },
  sessionId: 0,
  pendingBot: null,
  pendingRuling: null,
});

export const useGameStore = create((set, get) => ({
  ...session(),
  setPhase: (phase) => set({ phase }),
  setMatchMode: (matchMode) => set({ matchMode }),
  setSelectedCase: (selectedCase) => set({ selectedCase }),
  setPetitionerName: (petitionerName) => set({ petitionerName }),
  setRespondentName: (respondentName) => set({ respondentName }),
  sessionProfile: {},
  setSessionProfile: (profile) => set((state) => ({ sessionProfile: { ...state.sessionProfile, ...profile } })),
  matchMode: "1V1",
  humanSide: "petitioner",
  petitionerName: "Counsel A",
  respondentName: "Counsel B",
  theme: "dark",
  voiceEnabled: false,
  options: { openai_key: "", openai_model: "", allow_fallback: true },
  setOptions: (options) =>
    set((state) => ({ options: { ...state.options, ...options } })),
  toggleTheme: () =>
    set((state) => ({ theme: state.theme === "dark" ? "light" : "dark" })),
  toggleVoice: () => set((state) => ({ voiceEnabled: !state.voiceEnabled })),
  setDraft: (side, text) =>
    set((state) => ({ drafts: { ...state.drafts, [side]: text } })),
  setError: (error) => set({ error }),
  startGame: (config) =>
    set((state) => ({
      ...session(),
      ...config,
      sessionId: state.sessionId + 1,
      phase: GAME_PHASES.COURTROOM,
      judgeMessage: `The Court takes up ${config.selectedCase.title}. Petitioner, present your opening argument.`,
      transcript: [
        {
          id: crypto.randomUUID(),
          type: "judge",
          text: `The Court takes up ${config.selectedCase.title}. Petitioner, present your opening argument.`,
        },
      ],
    })),
  beginJudgePhase: () => set({ turnState: "JUDGE", error: "" }),
  restoreTurn: (side) =>
    set({ turnState: side.toUpperCase(), currentSpeaker: side }),
  setJudgeMessage: (message, interrupting = false) =>
    set({ judgeMessage: message, isInterrupting: interrupting }),
  addTranscript: (entry) =>
    set((state) => ({
      transcript: [
        ...state.transcript,
        {
          ...entry,
          id: crypto.randomUUID(),
          timestamp: new Date().toLocaleTimeString(),
        },
      ],
    })),
  updateScores: (side, evaluation) =>
    set((state) => {
      const history = [
        ...state.scores[side].history,
        {
          ...evaluation.delta_scores,
          feedback: evaluation.judge_response,
          notes: evaluation.judge_notes,
          round: state.roundNumber,
        },
      ];
      const averages = Object.fromEntries(
        Object.keys(CRITERIA).map((key) => {
          const values = history.map((h) => h[key]).filter((v) => v !== null);
          return [
            key,
            values.length
              ? values.reduce((a, b) => a + b, 0) / values.length
              : null,
          ];
        }),
      );
      const values = Object.values(averages).filter((v) => v !== null);
      const total = Math.round(
        ((values.reduce((a, b) => a + b, 0) / values.length + 3) / 6) * 100,
      );
      return {
        scores: { ...state.scores, [side]: { ...averages, total, history } },
        provider: evaluation.provider,
      };
    }),
  finishTurn: (side, interrupt) => {
    const state = get();
    if (interrupt && state.retryCountBySpeaker[side] < 2) {
      set({
        turnState: side.toUpperCase(),
        currentSpeaker: side,
        retryCountBySpeaker: {
          ...state.retryCountBySpeaker,
          [side]: state.retryCountBySpeaker[side] + 1,
        },
      });
      return;
    }
    if (side === "respondent" && state.roundNumber === state.maxRounds) {
      get().generateVerdict();
      return;
    }
    const next = side === "petitioner" ? "respondent" : "petitioner";
    set({
      turnState: next.toUpperCase(),
      currentSpeaker: next,
      roundNumber: state.roundNumber + (side === "respondent" ? 1 : 0),
      retryCountBySpeaker: { ...state.retryCountBySpeaker, [side]: 0 },
    });
  },
  acknowledgeRuling: () => {
    const pending = get().pendingRuling;
    if (!pending) return;
    set({ pendingRuling: null });
    get().finishTurn(pending.side, pending.interrupt);
  },
  generateVerdict: () => {
    const { scores } = get();
    if (!scores.petitioner.history.length || !scores.respondent.history.length)
      return;
    const margin = Math.abs(scores.petitioner.total - scores.respondent.total);
    const winnerSide =
      margin === 0
        ? null
        : scores.petitioner.total > scores.respondent.total
          ? "petitioner"
          : "respondent";
    set({
      verdict: { winnerSide, margin },
      phase: GAME_PHASES.VERDICT,
      turnState: "END",
    });
  },
  resetGame: () =>
    set((state) => ({ ...session(), sessionId: state.sessionId + 1 })),
}));
