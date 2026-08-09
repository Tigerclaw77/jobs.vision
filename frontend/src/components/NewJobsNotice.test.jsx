import React, { act } from "react";
import { createRoot } from "react-dom/client";
import NewJobsNotice from "./NewJobsNotice";
import { fetchNewJobsCount } from "../utils/api.supabase";
import { LAST_VISIT_KEY } from "../utils/newJobsVisit";

jest.mock("../utils/api.supabase", () => ({
  fetchNewJobsCount: jest.fn(),
}));

jest.mock(
  "react-router-dom",
  () => ({
    Link: ({ to, children, onClick, ...props }) => (
      <a
        href={to}
        onClick={(event) => {
          event.preventDefault();
          onClick?.(event);
        }}
        {...props}
      >
        {children}
      </a>
    ),
  }),
  { virtual: true }
);

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

async function renderNotice(count) {
  fetchNewJobsCount.mockResolvedValue(count);
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(<NewJobsNotice />);
    await Promise.resolve();
  });

  return {
    container,
    async cleanup() {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe("NewJobsNotice", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    fetchNewJobsCount.mockReset();
  });

  test("shows the weekly message for a first-time visitor and links to filtered jobs", async () => {
    const view = await renderNotice(5);
    const link = view.container.querySelector(".new-jobs-notice-link");

    expect(link.textContent).toBe("5 new jobs added this week");
    expect(link.getAttribute("href")).toContain("/jobs?publishedSince=");
    expect(link.getAttribute("href")).toContain("sort=newest");
    await act(async () =>
      link.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }))
    );
    expect(view.container.querySelector(".new-jobs-notice")).toBeNull();
    await view.cleanup();
  });

  test("shows the returning-visitor message when prior history is usable", async () => {
    localStorage.setItem(LAST_VISIT_KEY, "2026-08-06T15:30:00.000Z");
    const view = await renderNotice(6);

    expect(view.container.textContent).toContain("6 new jobs since your last visit");
    expect(fetchNewJobsCount).toHaveBeenCalledWith("2026-08-06T15:30:00.000Z");
    await view.cleanup();
  });

  test("does not render for a trivial count", async () => {
    const view = await renderNotice(2);
    expect(view.container.querySelector(".new-jobs-notice")).toBeNull();
    await view.cleanup();
  });

  test("dismisses and does not request the notice again in the same session", async () => {
    const firstView = await renderNotice(5);
    const dismiss = firstView.container.querySelector(".new-jobs-notice-dismiss");

    await act(async () => dismiss.dispatchEvent(new MouseEvent("click", { bubbles: true })));
    expect(firstView.container.querySelector(".new-jobs-notice")).toBeNull();
    await firstView.cleanup();

    const secondView = await renderNotice(5);
    expect(fetchNewJobsCount).toHaveBeenCalledTimes(1);
    expect(secondView.container.querySelector(".new-jobs-notice")).toBeNull();
    await secondView.cleanup();
  });
});
