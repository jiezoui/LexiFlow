const EXAM_LABELS: Record<string, string> = {
  GENERAL: "通用",
  CET4: "四级",
  CET6: "六级",
  POSTGRAD: "考研",
  IELTS: "雅思",
  TOEFL: "托福",
}

export function storyExamLabel(focus?: string | null) {
  if (!focus || focus === "GENERAL") return ""
  return EXAM_LABELS[focus] ?? focus
}
