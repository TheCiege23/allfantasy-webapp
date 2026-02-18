export const FEEDBACK_REASONS = [
  { label: 'Overvalued player/pick', enum: 'OVERVALUED' },
  { label: 'Too risky (injury/age)', enum: 'TOO_RISKY' },
  { label: 'Not my style / preference', enum: 'NOT_MY_STYLE' },
  { label: 'Bad roster fit', enum: 'BAD_ROSTER_FIT' },
  { label: 'Other', enum: 'OTHER' },
] as const

export type FeedbackReasonLabel = typeof FEEDBACK_REASONS[number]['label']
export type FeedbackReasonEnum = typeof FEEDBACK_REASONS[number]['enum']
