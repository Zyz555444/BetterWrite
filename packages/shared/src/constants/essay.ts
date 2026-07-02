export const TopicType = {
  LETTER: 'letter',
  SPEECH: 'speech',
  ARGUMENTATION: 'argumentation',
  NARRATION: 'narration',
  PROPOSAL: 'proposal',
} as const;

export type TopicTypeValue = (typeof TopicType)[keyof typeof TopicType];

export const TopicCategory = {
  SCHOOL_LIFE: 'school_life',
  SOCIAL_ISSUES: 'social_issues',
  CULTURE: 'culture',
  TECH: 'tech',
  GROWTH: 'growth',
  TRAVEL: 'travel',
} as const;

export type TopicCategoryValue = (typeof TopicCategory)[keyof typeof TopicCategory];

export const ErrorType = {
  TENSE: 'tense',
  SUBJECT_VERB: 'subject_verb',
  SPELLING: 'spelling',
  PLURAL: 'plural',
  ARTICLE: 'article',
  PREPOSITION: 'preposition',
  WORD_FORM: 'word_form',
  PRONOUN: 'pronoun',
  CHINGLISH: 'chinglish',
  SENTENCE_STRUCTURE: 'sentence_structure',
  COLLOCATION: 'collocation',
} as const;

export type ErrorTypeValue = (typeof ErrorType)[keyof typeof ErrorType];
