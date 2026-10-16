/** Place ids in the list that this run did not finish.
 * A killed child is included: its own stop never ran.
 * A place already in `finished` is left alone. */
export function placesTheWaveDidNotFinish(
  jobs: readonly { placeId: string }[],
  finished: readonly { placeId: string }[],
): string[] {
  const done = new Set(finished.map((row) => row.placeId));
  return jobs.map((job) => job.placeId).filter((id) => !done.has(id));
}
