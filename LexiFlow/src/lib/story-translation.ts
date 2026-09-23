/** Remove vocabulary annotation leaked into a Chinese story translation. */
export function cleanStoryTranslation(translation: string): string {
  return translation.replace(/\[\[([^\]]+)\]\]/g, (_marker, content: string) => {
    const visible = content.split("|", 1)[0].trim()
    if (!/\p{Script=Han}/u.test(visible)) return ""
    return visible.replace(/[A-Za-z]+(?:['’-][A-Za-z]+)*/g, "").trim()
  })
}
