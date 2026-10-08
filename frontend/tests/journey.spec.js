import { test, expect } from "@playwright/test";
import { Buffer } from "node:buffer";

const ARGUMENT = "The measure fails proportionality because less restrictive safeguards can protect the public interest.";

async function selectCase(page) {
  await page.goto("/");
  await page.locator(".game-case-card").first().click();
  await page.getByRole("button", { name: "Take this case" }).click();
}

async function start(page, side = null) {
  await selectCase(page);
  if (side) {
    await page.getByRole("button", { name: /Solo practice/ }).click();
    await page.getByLabel("Your side").selectOption(side);
  } else {
    await page.getByRole("button", { name: /Two players/ }).click();
  }
  await page.getByRole("button", { name: "Enter the courtroom" }).click();
  await expect(page.locator(".hearing-progress")).toContainText("Opening arguments");
}

async function submit(page, side, text = ARGUMENT) {
  await expect(page.locator(`#argument-${side}`)).toBeEnabled();
  await page.locator(`#argument-${side}`).fill(text);
  await page.getByRole("button", { name: "Submit argument" }).click();
}

async function continueRuling(page, label) {
  const button = page.locator(".continue-button");
  await expect(button).toBeVisible();
  if (label) await expect(button).toContainText(label);
  await button.click();
}

async function expectRecordCount(page, count) {
  await page.getByRole("button", { name: /The court record/ }).click();
  await expect(page.getByRole("dialog", { name: "Court record" }).locator(".transcript-entry")).toHaveCount(count);
  await page.getByRole("button", { name: "Close dialog" }).click();
}

async function expectNoOverflow(page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  const dialog = page.getByRole("dialog");
  if (await dialog.count()) {
    expect(await dialog.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
}

test("local hearing waits for each ruling, completes three rounds and downloads its record", async ({ page }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await start(page);
  for (let round = 1; round <= 3; round++) {
    await submit(page, "petitioner");
    await expect(page.locator(".hearing-progress")).toContainText("A ruling from the bench");
    await expect(page.locator(".hearing-progress")).toContainText(`ROUND ${round} / 3`);
    await expect(page.locator("#argument-respondent")).toHaveCount(0);
    await continueRuling(page, "Hear the respondent");
    await expect(page.locator(".hearing-progress")).toContainText("Counsel B has the floor");
    await submit(page, "respondent");
    await continueRuling(page, round === 3 ? "See the scorecard" : "Begin next round");
  }
  await expect(page.getByText("HEARING COMPLETE · THREE ROUNDS")).toBeVisible();
  await expect(page.locator(".result-intro")).toContainText("Counsel A");
  await expect(page.locator(".result-total").first()).toContainText("83");
  await expect(page.locator(".transcript-entry")).toHaveCount(13);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download hearing" }).click();
  expect((await download).suggestedFilename()).toBe("themis-hearing.txt");
  await page.getByRole("button", { name: "Try another matter" }).click();
  await expect(page.getByRole("heading", { name: /Choose your next case/ })).toBeVisible();
  expect(errors).toEqual([]);
});

for (const side of ["petitioner", "respondent"]) {
  test(`solo ${side} completes a hearing with explicit opponent ruling review`, async ({ page }) => {
    await start(page, side);
    for (let round = 1; round <= 3; round++) {
      if (side === "respondent") {
        await expect(page.locator(".opponent-submission")).toBeVisible();
        await continueRuling(page, "Hear the respondent");
      }
      await submit(page, side);
      await continueRuling(page, side === "petitioner" ? "Hear the respondent" : round === 3 ? "See the scorecard" : "Begin next round");
      if (side === "petitioner") {
        await expect(page.locator(".opponent-submission")).toBeVisible();
        await page.getByText("Read opposing counsel’s submission", { exact: true }).click();
        await expect(page.locator(".opponent-submission p")).toContainText("safeguards");
        await continueRuling(page, round === 3 ? "See the scorecard" : "Begin next round");
      }
    }
    await expect(page.getByText("HEARING COMPLETE · THREE ROUNDS")).toBeVisible();
    await expect(page.locator(".transcript-entry")).toHaveCount(13);
  });
}

test("errors preserve the human draft, do not score, and retry records exactly one turn", async ({ page }) => {
  await start(page);
  await page.route("**/api/argue", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "The judge is temporarily unavailable." }) }));
  await submit(page, "petitioner", "Preserve this draft.");
  await expect(page.getByRole("alert")).toContainText("No points were added or lost");
  await expect(page.locator("#argument-petitioner")).toHaveValue("Preserve this draft.");
  await expect(page.locator(".mini-petitioner > strong")).toContainText("—");
  await expectRecordCount(page, 1);
  await page.unroute("**/api/argue");
  await submit(page, "petitioner", "Preserve this draft.");
  await expect(page.locator(".continue-button")).toBeVisible();
  await expectRecordCount(page, 3);
  await continueRuling(page);
  await expect(page.locator("#argument-respondent")).toHaveValue("");
});

test("two bench follow-ups are allowed, then the hearing moves to opposing counsel", async ({ page }) => {
  await start(page, "petitioner");
  for (let i = 0; i < 3; i++) {
    await submit(page, "petitioner", "FOLLOWUP: Apply proportionality to these facts.");
    await continueRuling(page, i < 2 ? "Answer the bench" : "Hear the respondent");
  }
  await expect(page.locator(".opponent-submission")).toBeVisible();
  await expectRecordCount(page, 9);
  await continueRuling(page, "Begin next round");
  await expect(page.locator(".hearing-progress")).toContainText("ROUND 2 / 3");
  await expect(page.locator("#argument-petitioner")).toBeEnabled();
});

test("opposing counsel failure retries without repeating the accepted human turn", async ({ page }) => {
  await start(page, "petitioner");
  await page.route("**/api/counsel", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Opposing counsel unavailable." }) }));
  await submit(page, "petitioner");
  await continueRuling(page);
  await expect(page.getByRole("alert")).toBeVisible();
  await expectRecordCount(page, 3);
  await page.unroute("**/api/counsel");
  await page.getByRole("button", { name: "Retry opposing counsel" }).click();
  await expect(page.locator(".opponent-submission")).toBeVisible();
  await expectRecordCount(page, 5);
  await continueRuling(page, "Begin next round");
  await expect(page.locator(".hearing-progress")).toContainText("ROUND 2 / 3");
});

test("failed opposing assessment reuses the generated argument on retry", async ({ page }) => {
  await start(page, "petitioner");
  let generated = 0;
  const assessed = [];
  page.on("request", request => { if (request.url().endsWith("/api/counsel")) generated++; });
  await page.route("**/api/argue", route => {
    const request = route.request().postDataJSON();
    if (request.role === "Respondent") {
      assessed.push(request.text);
      if (assessed.length === 1) return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Judge unavailable." }) });
    }
    return route.continue();
  });
  await submit(page, "petitioner");
  await continueRuling(page);
  await expect(page.getByRole("alert")).toBeVisible();
  expect(generated).toBe(1);
  await page.getByRole("button", { name: "Retry opposing counsel" }).click();
  await expect(page.locator(".opponent-submission")).toBeVisible();
  expect(generated).toBe(1);
  expect(assessed).toHaveLength(2);
  expect(assessed[1]).toBe(assessed[0]);
  await expectRecordCount(page, 5);
});

test("withdrawing a pending request preserves the draft and allows resubmission", async ({ page }) => {
  await start(page);
  let heldRoute;
  await page.route("**/api/argue", route => { heldRoute = route; });
  await submit(page, "petitioner", "This submission is safe to withdraw.");
  await page.getByRole("button", { name: "Withdraw request" }).click();
  await expect(page.getByRole("alert")).toContainText("Request withdrawn");
  await expect(page.locator("#argument-petitioner")).toHaveValue("This submission is safe to withdraw.");
  await expect(page.locator("#argument-petitioner")).toBeEnabled();
  await heldRoute?.abort();
  await page.unroute("**/api/argue");
  await expectRecordCount(page, 1);
  await submit(page, "petitioner", "This submission is safe to withdraw.");
  await expect(page.locator(".continue-button")).toBeVisible();
  await expectRecordCount(page, 3);
});

test("equal scores produce a draw even with identical counsel names", async ({ page }) => {
  await selectCase(page);
  await page.getByLabel("Petitioner’s name").fill("Counsel");
  await page.getByLabel("Respondent’s name").fill("Counsel");
  await page.getByRole("button", { name: "Enter the courtroom" }).click();
  for (let round = 0; round < 3; round++) {
    await submit(page, "petitioner", "TIE: Apply proportionality.");
    await continueRuling(page);
    await submit(page, "respondent", "TIE: Apply proportionality.");
    await continueRuling(page);
  }
  await expect(page.locator(".result-intro")).toContainText("Neither side is declared the winner");
  await expect(page.locator(".result-lead")).toHaveCount(0);
});

test("archive searches substantive issues, filters subjects, paginates and handles no results", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator(".game-case-card")).toHaveCount(9);
  const initialTitle = await page.locator(".game-case-card h3").first().textContent();
  await page.getByRole("button", { name: "Next files" }).click();
  await expect(page.locator(".library-pagination")).toContainText("10–18 of 56");
  await expect(page.locator(".game-case-card h3").first()).not.toHaveText(initialTitle);
  await page.getByLabel("Search cases").fill("Puttaswamy privacy");
  await expect(page.locator(".game-case-card")).toHaveCount(1);
  await page.locator(".game-case-card").click();
  await expect(page.getByRole("dialog")).toContainText("Petitioner’s position");
  await expect(page.getByRole("link", { name: /Read the judgment on Indian Kanoon/ })).toHaveAttribute("href", "https://indiankanoon.org/doc/91938676/");
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.getByRole("button", { name: "Clear search" }).click();
  await page.getByLabel("Filter by category").selectOption("Education");
  await expect(page.locator(".game-case-card")).toHaveCount(8);
  await page.getByLabel("Search cases").fill("no-such-case-987xyz");
  await expect(page.getByRole("heading", { name: "No matching files." })).toBeVisible();
  await expect(page.getByRole("link", { name: "Search Indian Kanoon" })).toHaveAttribute("href", /no-such-case-987xyz/);
  await page.getByRole("button", { name: "Clear filters" }).click();
  await expect(page.locator(".game-case-card")).toHaveCount(9);
});

test("uploaded moot document is reviewed, edited and sent to the real hearing endpoint", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Bring your own case/ }).click();
  await page.getByLabel("Upload case documents").setInputFiles({ name: "School_moot.txt", mimeType: "text/plain", buffer: Buffer.from("The university cancels a students' debate without a hearing. The students challenge the cancellation.") });
  await expect(page.getByLabel("Case title")).toHaveValue("School moot");
  await expect(page.getByLabel("Facts & proposition")).toHaveValue(/The university cancels/);
  const facts = "The university cancels the debate without notice. A written safety assessment is contested by both sides.";
  await page.getByLabel("Facts & proposition").fill(facts);
  await page.getByLabel("Questions for the bench").fill("Does cancellation without notice satisfy natural justice?");
  await page.getByLabel("Authorities / applicable law").fill("Article 19(1)(a), Constitution of India");
  await page.getByRole("button", { name: "Choose counsel" }).click();
  await page.getByRole("button", { name: "The brief", exact: true }).click();
  await expect(page.locator(".brief-content")).toContainText(facts);
  await page.getByRole("button", { name: "Take this case" }).click();
  await page.getByRole("button", { name: "Enter the courtroom" }).click();
  const request = page.waitForRequest(request => request.url().endsWith("/api/argue"));
  await submit(page, "petitioner");
  expect((await request).postDataJSON().selectedCase.facts).toBe(facts);
  await expect(page.locator(".continue-button")).toBeVisible();
  await expectRecordCount(page, 3);
});

test("long imports remain complete and unreadable uploads can be recovered by pasting", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Bring your own case/ }).click();
  await page.getByLabel("Upload case documents").setInputFiles({ name: "scanned.pdf", mimeType: "application/pdf", buffer: Buffer.from("invalid PDF content") });
  await expect(page.getByRole("alert")).toContainText("could not be read");
  await page.getByLabel("Case text", { exact: true }).fill("The petitioner's liberty is challenged.");
  await page.getByRole("button", { name: "Review case file" }).click();
  await expect(page.getByLabel("Facts & proposition")).toHaveValue("The petitioner's liberty is challenged.");
  await expect(page.getByRole("alert")).toHaveCount(0);
  await page.getByRole("button", { name: "Back to documents" }).click();
  const fullText = "All facts must survive import. ".repeat(1100);
  await page.getByLabel("Upload case documents").setInputFiles({ name: "long_moot.txt", mimeType: "text/plain", buffer: Buffer.from(fullText) });
  await expect(page.getByLabel("Facts & proposition")).toHaveValue(fullText.trim());
  await expect(page.getByText("The complete extraction is shown.", { exact: false })).toBeVisible();
  await expect(page.getByRole("button", { name: "Choose counsel" })).toBeDisabled();
  await page.getByLabel("Facts & proposition").fill("The edited proposition retains the material facts.");
  await page.getByLabel("Questions for the bench").fill("Was the hearing fair?");
  await expect(page.getByRole("button", { name: "Choose counsel" })).toBeEnabled();
});

test("multiple uploaded documents retain their content and filenames for review", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Bring your own case/ }).click();
  await page.getByLabel("Upload case documents").setInputFiles([
    { name: "Proposition.txt", mimeType: "text/plain", buffer: Buffer.from("The university restricts student speech.") },
    { name: "Clarifications.txt", mimeType: "text/plain", buffer: Buffer.from("Clarification: no hearing was offered before the restriction.") },
  ]);
  await expect(page.locator(".file-chips span")).toHaveCount(2);
  await expect(page.getByLabel("Facts & proposition")).toHaveValue("DOCUMENT: Proposition.txt\n\nThe university restricts student speech.\n\nDOCUMENT: Clarifications.txt\n\nClarification: no hearing was offered before the restriction.");
  await page.getByRole("button", { name: "Close dialog" }).click({ trial: true });
  page.once("dialog", dialog => dialog.dismiss());
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("dialog", { name: "Bring your own case" })).toBeVisible();
  page.once("dialog", dialog => dialog.accept());
  await page.getByRole("button", { name: "Close dialog" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("a custom case cannot enter court above the combined context budget", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /Bring your own case/ }).click();
  await page.getByLabel("Case text", { exact: true }).fill("Fact. ".repeat(5000));
  await page.getByRole("button", { name: "Review case file" }).click();
  await page.getByLabel("Case title").fill("Context budget moot");
  await page.getByLabel("Questions for the bench").fill("Was the hearing fair?");
  await page.getByLabel("Authorities / applicable law").fill(Array(31).fill("a".repeat(1000)).join("\n"));
  await page.getByRole("button", { name: "Choose counsel" }).click();
  await expect(page.getByRole("alert")).toContainText("together must fit within 60,000 characters");
  await expect(page.getByRole("button", { name: "Enter the courtroom" })).toHaveCount(0);
  await page.getByLabel("Authorities / applicable law").fill("Article 21, Constitution of India");
  await page.getByRole("button", { name: "Choose counsel" }).click();
  await expect(page.getByRole("button", { name: "Enter the courtroom" })).toBeVisible();
});

test("an unavailable archive offers clearly labelled quick drills and recovers on retry", async ({ page }) => {
  await page.route("**/api/cases?*", route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ detail: "Archive unavailable" }) }));
  await page.goto("/");
  await expect(page.getByRole("status")).toContainText("The record room is offline");
  await expect(page.locator(".game-case-card")).toHaveCount(5);
  await expect(page.locator(".game-case-card").first()).toContainText("Fictional quick drill");
  await page.unroute("**/api/cases?*");
  await page.getByRole("button", { name: "Retry library" }).click();
  await expect(page.locator(".game-case-card")).toHaveCount(9);
  await expect(page.locator(".library-notice")).toHaveCount(0);
});

test("mobile keyboard navigation, dialogs and courtroom fit without overflow; secrets remain in memory", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  const card = page.locator(".game-case-card").first();
  await expect(card).toBeVisible();
  await expectNoOverflow(page);
  await card.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("dialog", { name: "Case file" })).toBeVisible();
  await expectNoOverflow(page);
  await page.keyboard.press("Escape");
  await expect(card).toBeFocused();
  await page.getByRole("button", { name: "Open settings" }).click();
  await page.getByLabel("Fallback API key").fill("secret-sentinel");
  expect(await page.evaluate(() => JSON.stringify({ local: localStorage, session: sessionStorage }))).not.toContain("secret-sentinel");
  await page.getByRole("button", { name: "Clear override" }).click();
  await expect(page.getByLabel("Fallback API key")).toHaveValue("");
  await expectNoOverflow(page);
  await page.getByRole("button", { name: "Close dialog" }).click();
  await card.click();
  await page.getByRole("button", { name: "Take this case" }).click();
  await expectNoOverflow(page);
  await page.getByRole("button", { name: "Enter the courtroom" }).click();
  await expect(page.locator("#argument-petitioner")).toBeEnabled();
  await expectNoOverflow(page);
  await submit(page, "petitioner");
  await expect(page.locator(".continue-button")).toBeVisible();
  await expectNoOverflow(page);
  await page.screenshot({ path: "/tmp/themis-mobile-court.png", fullPage: true });
});
