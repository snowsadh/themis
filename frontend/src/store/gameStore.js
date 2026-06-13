import { create } from 'zustand';

export const GAME_PHASES = {
  LOBBY: 'LOBBY',
  CASE_SELECT: 'CASE_SELECT',
  COURTROOM: 'COURTROOM',
  VERDICT: 'VERDICT',
};

export const TURN_STATES = {
  WAITING: 'WAITING',
  PETITIONER: 'PETITIONER',
  JUDGE: 'JUDGE',
  RESPONDENT: 'RESPONDENT',
  END: 'END',
};

const initialScores = {
  petitioner: { logic: 0, clarity: 0, confidence: 0, total: 0, evidence: [], reasoning_breakdown: null, history: [] },
  respondent: { logic: 0, clarity: 0, confidence: 0, total: 0, evidence: [], reasoning_breakdown: null, history: [] },
};

const initialRetryCountBySpeaker = {
  petitioner: 0,
  respondent: 0,
};

export const useGameStore = create((set, get) => ({
  phase: GAME_PHASES.LOBBY,
  matchMode: '1V1',
  turnState: TURN_STATES.WAITING,
  currentSpeaker: 'petitioner',
  retryCountBySpeaker: initialRetryCountBySpeaker,
  selectedCase: null,
  petitionerName: 'Counsel A',
  respondentName: 'Counsel B',
  sessionProfile: {
    displayName: '',
    email: '',
    roomCode: '',
    accessMode: 'guest',
  },
  scores: initialScores,
  transcript: [],
  judgeMessage: null,
  judgeInterruptContext: null,
  isJudgeSpeaking: false,
  isInterrupting: false,
  timer: 60,
  timerActive: false,
  roundNumber: 1,
  maxRounds: 3,
  objectionActive: null,
  verdict: null,
  theme: 'dark',
  showVerdict: false,

  toggleTheme: () => set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
  setPhase: (phase) => set({ phase }),
  setMatchMode: (matchMode) => set({ matchMode }),
  setSelectedCase: (c) => set({ selectedCase: c }),
  setPetitionerName: (name) => set({ petitionerName: name }),
  setRespondentName: (name) => set({ respondentName: name }),
  setSessionProfile: (profile) => set((state) => ({
    sessionProfile: {
      ...state.sessionProfile,
      ...profile,
    },
  })),

  startGame: (config = {}) => set((state) => {
    const matchMode = config.matchMode || state.matchMode;
    const petitionerName = config.petitionerName || state.petitionerName;
    const respondentName = config.respondentName || state.respondentName;

    return {
      phase: GAME_PHASES.COURTROOM,
      matchMode,
      turnState: TURN_STATES.PETITIONER,
      currentSpeaker: 'petitioner',
      retryCountBySpeaker: initialRetryCountBySpeaker,
      selectedCase: config.selectedCase || state.selectedCase,
      petitionerName,
      respondentName,
      sessionProfile: {
        ...state.sessionProfile,
        ...(config.sessionProfile || {}),
      },
      scores: initialScores,
      transcript: [],
      judgeMessage: null,
      judgeInterruptContext: null,
      isJudgeSpeaking: false,
      timer: 60,
      timerActive: true,
      roundNumber: 1,
      objectionActive: null,
      verdict: null,
      showVerdict: false,
    };
  }),

  setTurn: (turn) => set({
    turnState: turn,
    currentSpeaker: turn === TURN_STATES.PETITIONER ? 'petitioner' : turn === TURN_STATES.RESPONDENT ? 'respondent' : get().currentSpeaker,
    timer: 60,
    timerActive: turn !== TURN_STATES.JUDGE,
  }),

  beginJudgePhase: () => set({ turnState: TURN_STATES.JUDGE, timerActive: false }),

  resetRetriesForSpeaker: (speaker) => set((state) => ({
    retryCountBySpeaker: {
      ...state.retryCountBySpeaker,
      [speaker]: 0,
    },
  })),

  resumeSameSpeakerWithRetry: (speaker) => set((state) => ({
    currentSpeaker: speaker,
    turnState: speaker === 'petitioner' ? TURN_STATES.PETITIONER : TURN_STATES.RESPONDENT,
    timer: 60,
    timerActive: true,
    retryCountBySpeaker: {
      ...state.retryCountBySpeaker,
      [speaker]: Math.min((state.retryCountBySpeaker[speaker] || 0) + 1, 2),
    },
  })),

  advanceToOtherSpeaker: (speaker) => {
    const nextSpeaker = speaker === 'petitioner' ? 'respondent' : 'petitioner';
    set((state) => ({
      currentSpeaker: nextSpeaker,
      turnState: nextSpeaker === 'petitioner' ? TURN_STATES.PETITIONER : TURN_STATES.RESPONDENT,
      timer: 60,
      timerActive: true,
      retryCountBySpeaker: {
        ...state.retryCountBySpeaker,
        [speaker]: 0,
      },
    }));
  },

  addTranscript: (entry) => set((state) => ({
    transcript: [...state.transcript, { ...entry, id: Date.now(), timestamp: new Date().toLocaleTimeString() }]
  })),

  setJudgeMessage: (message, interrupting = false, interruptContext = null) => set({
    judgeMessage: message,
    isJudgeSpeaking: !!message,
    isInterrupting: interrupting,
    judgeInterruptContext: interruptContext,
  }),

  clearJudge: () => set({ judgeMessage: null, isJudgeSpeaking: false, isInterrupting: false, judgeInterruptContext: null }),

  updateScores: (side, newScores) => set((state) => {
    const prev = state.scores[side];
    const logic = Math.min(10, (prev.logic * 0.6 + newScores.logic * 0.4));
    const clarity = Math.min(10, (prev.clarity * 0.6 + newScores.clarity * 0.4));
    const confidence = Math.min(10, (prev.confidence * 0.6 + newScores.confidence * 0.4));
    const total = Math.round((logic + clarity + confidence) / 3 * 10);
    return {
      scores: {
        ...state.scores,
        [side]: {
          logic: parseFloat(logic.toFixed(1)),
          clarity: parseFloat(clarity.toFixed(1)),
          confidence: parseFloat(confidence.toFixed(1)),
          total,
          evidence: newScores.evidence || [],
          reasoning_breakdown: newScores.reasoning_breakdown || null,
          history: [...prev.history, { logic, clarity, confidence, total, round: state.roundNumber }]
        }
      }
    };
  }),

  setObjection: (side) => set({ objectionActive: side }),
  clearObjection: () => set({ objectionActive: null }),

  tickTimer: () => set((state) => {
    if (!state.timerActive || state.timer <= 0) return {};
    return { timer: state.timer - 1 };
  }),

  setTimerActive: (active) => set({ timerActive: active }),

  nextRound: () => {
    const { roundNumber, maxRounds, turnState } = get();
    if (roundNumber >= maxRounds) {
      get().generateVerdict();
      return;
    }
    const nextTurn = turnState === TURN_STATES.PETITIONER ? TURN_STATES.RESPONDENT : TURN_STATES.PETITIONER;
    set({ roundNumber: roundNumber + 1, turnState: nextTurn, timer: 60, timerActive: true });
  },

  generateVerdict: () => {
    const { scores, petitionerName, respondentName } = get();
    const pTotal = scores.petitioner.total;
    const rTotal = scores.respondent.total;
    const winner = pTotal >= rTotal ? petitionerName : respondentName;
    const loser = pTotal >= rTotal ? respondentName : petitionerName;
    const margin = Math.abs(pTotal - rTotal);

    const verdict = {
      winner,
      loser,
      petitionerScore: pTotal,
      respondentScore: rTotal,
      margin,
      decision: pTotal >= rTotal ? 'ALLOWED' : 'DISMISSED',
      reasoning: margin > 20
        ? `${winner} demonstrated significantly superior legal reasoning, clear precedential analysis, and compelling argumentation throughout the proceedings.`
        : margin > 10
        ? `${winner} provided stronger arguments with better use of legal precedents and more structured submissions.`
        : `This was a closely contested matter. ${winner} prevailed by a narrow margin due to slightly clearer articulation of legal principles.`,
    };
    set({ verdict, showVerdict: true, phase: GAME_PHASES.VERDICT, turnState: TURN_STATES.END, timerActive: false });
  },

  resetGame: () => set({
    phase: GAME_PHASES.LOBBY,
    matchMode: '1V1',
    turnState: TURN_STATES.WAITING,
    currentSpeaker: 'petitioner',
    retryCountBySpeaker: initialRetryCountBySpeaker,
    selectedCase: null,
    sessionProfile: {
      displayName: '',
      email: '',
      roomCode: '',
      accessMode: 'guest',
    },
    scores: initialScores,
    transcript: [],
    judgeMessage: null,
    judgeInterruptContext: null,
    isJudgeSpeaking: false,
    isInterrupting: false,
    timer: 60,
    timerActive: false,
    roundNumber: 1,
    objectionActive: null,
    verdict: null,
    showVerdict: false,
  }),
}));
