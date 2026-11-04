export const permutations = <T,>(values: readonly T[]): T[][] => {
  if (values.length < 2) return [Array.from(values)]
  return values.flatMap((value, index) => {
    const remaining = [...values.slice(0, index), ...values.slice(index + 1)]
    return permutations(remaining).map((suffix) => [value, ...suffix])
  })
}
