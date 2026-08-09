import {
  LAST_VISIT_KEY,
  NEW_JOBS_MIN_COUNT,
  SESSION_NOTICE_KEY,
  beginNewJobsVisit,
  buildNewJobsHref,
  newJobsMessage,
  shouldShowNewJobs,
} from "./newJobsVisit";

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
  };
}

describe("new jobs revisit notification", () => {
  const now = Date.parse("2026-08-09T12:00:00.000Z");

  test("uses the last seven days for a first-time visitor", () => {
    const localStorage = memoryStorage();
    const sessionStorage = memoryStorage();
    const visit = beginNewJobsVisit({ now, localStorage, sessionStorage });

    expect(visit).toEqual({
      cutoff: "2026-08-02T12:00:00.000Z",
      mode: "weekly",
    });
    expect(localStorage.getItem(LAST_VISIT_KEY)).toBe("2026-08-09T12:00:00.000Z");
  });

  test("uses valid previous visit history for a returning visitor", () => {
    const localStorage = memoryStorage({
      [LAST_VISIT_KEY]: "2026-08-06T15:30:00.000Z",
    });
    const visit = beginNewJobsVisit({ now, localStorage, sessionStorage: memoryStorage() });

    expect(visit).toEqual({
      cutoff: "2026-08-06T15:30:00.000Z",
      mode: "returning",
    });
    expect(newJobsMessage(6, visit.mode)).toBe("6 new jobs since your last visit");
  });

  test("does not start the notice twice in one session", () => {
    const sessionStorage = memoryStorage({ [SESSION_NOTICE_KEY]: "1" });
    expect(beginNewJobsVisit({ now, localStorage: memoryStorage(), sessionStorage })).toBeNull();
  });

  test("hides trivial counts and links to the exact publication cutoff", () => {
    expect(shouldShowNewJobs(NEW_JOBS_MIN_COUNT - 1)).toBe(false);
    expect(shouldShowNewJobs(NEW_JOBS_MIN_COUNT)).toBe(true);
    expect(buildNewJobsHref("2026-08-06T15:30:00.000Z")).toBe(
      "/jobs?publishedSince=2026-08-06T15%3A30%3A00.000Z&sort=newest&page=1"
    );
    expect(newJobsMessage(8, "weekly")).toBe("8 new jobs added this week");
  });
});
