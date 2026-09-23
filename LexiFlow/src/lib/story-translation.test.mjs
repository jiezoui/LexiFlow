import assert from "node:assert/strict"
import test from "node:test"
import { cleanStoryTranslation } from "./story-translation.ts"

test("cleans leaked English lemmas from an existing Chinese story translation", () => {
  const source = "当林博士提议前往偏远湿地进行一次[[冒险adventure]]时，她知道准备是[[明智的|advisable]]。\n\n他们[[承认admit]]了错误。"
  assert.equal(cleanStoryTranslation(source), "当林博士提议前往偏远湿地进行一次冒险时，她知道准备是明智的。\n\n他们承认了错误。")
})
