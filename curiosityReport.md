# Curiosity report

## Automated AI code review in CI pipeline

Humans can catch some bugs, but they obviously make mistakes. Even though machines aren't perfect either, they can catch more bugs and do it faster, especially as models improve. So why shouldn't we automate the process of catching bugs and code review?

I find this topic interesting because I currently work for a software engineering company called Redo, in Draper, Utah. Over the past 4 or 5 months, we have exploded the amount of PRs that we have merged month over month. Back in July, we were at about 600 with around 50 or 60 engineers, and now we're at about 13,000 so far for November. There are only 70 engineers. The volume at which code is produced and released in 2026 has grown at an exponential rate. With the rate at which the business demands that software is built, it is actually impossible to review all of this line by line by humans. A lot of the way that Redo reviews its code is done by machines, and this is the inspiration for this curiosity report, since I wanted to try to add some machine review to JWT pizza.

## Research method

About a month ago, I read an [article](https://claude.dev/blog/solving-code-review-at-anthropic/) from Anthropic about how the Claude Code team does code review. This article really changed my perspective in a couple of ways, the first being that humans don't necessarily need to catch many mistakes because machines can do it much better when doing code review. Another is that the Anthropic team has gotten way more confident in the changes that they do ship because the number of rollbacks and reverts that they do is even lower than it was before. This got me thinking since it's quite similar to how Redo has paced so far. We do have some tools like Cursor Bug Bot that work in a similar fashion and catch many, many bugs before they make it to production. They can be fixed beforehand, and the number of times that we have to roll back or revert after a change goes out is very little compared to the number of PRs that are merged.

These are the ideas from the article that I copied into my own setup:
- **Find, then verify.** The reviewer first lists possible problems, then checks each one (is it actually reachable? did this PR cause it?) and throws out the ones that are wrong before posting anything. This cuts down on noise.
- **Severity tags** (Critical, High, Medium, Low, Nit), so it is obvious what blocks a merge and what is optional.
- **A REVIEW.md rules file** in the repo that tells the reviewer how to behave.
- **Never approve.** The AI only comments or requests changes. Approving is still a human decision.
- **Re-reviews only look at new changes** and don't repeat findings that were already posted.

I intentionally kept REVIEW.md neutral. It never mentions SQL injection or any specific bug type, because I didn't want to lead the reviewer to the answer and make the experiment pointless.

## Current state of art for topic

I think that the experiment that I run and the current state of this topic are in a pretty good spot, as far as AI code reviews are concerned. They are way better than they were even 6 months ago, because coding tools have gotten much better than they were previously. There are already a lot of products for this, like Cursor Bugbot (which we use at Redo), GitHub Copilot code review, and CodeRabbit. What I built is basically a do-it-yourself version that costs nothing extra on top of my Claude subscription and lets me write my own rules. I can only foresee that code reviews will get cheaper, quicker, and more effective with time as models improve and training data on coding datasets gets much more sophisticated.

There are some DevOps risks to think about, though. The workflow uses the `pull_request` trigger instead of `pull_request_target`, so pull requests from forks never get access to my repository secrets. The agent is also only allowed to read files and post PR comments, so it can't push code or approve anything. The text of a PR is also untrusted input, so in theory someone could write a PR description trying to talk the reviewer out of flagging their bug (prompt injection). But at the same time, the PR context could be valuable for the review, so it's a trade-off. I could try both in the future.

## Experiments

I decided to run this experiment of adding an AI code review (using my Claude Code subscription that I had already owned previously) into the CI pipeline of PRs that are made on the jwt-pizza-service repository. I did this by adding this [claude-review.yml](https://github.com/isaacsmith3/jwt-pizza-service/blob/main/.github/workflows/claude-review.yml) file to the repository. This file is a GitHub Actions workflow that runs on every pull request to the repository. It uses the `anthropics/claude-code-action` GitHub Action to review the code. The AI coding agent will read the PR description and the diff, and follow the rules in [REVIEW.md](https://github.com/isaacsmith3/jwt-pizza-service/blob/main/REVIEW.md) for how to grade and what to post. It posts each finding as an inline comment on the code, plus one summary comment on the PR thread.

### How to reproduce

1. Install the [Claude GitHub App](https://github.com/apps/claude) on your repository.
2. Run `claude setup-token` locally and save the token as a repository secret named `CLAUDE_CODE_OAUTH_TOKEN`. This uses a Claude subscription, so no API credits are needed.
3. Copy [claude-review.yml](https://github.com/isaacsmith3/jwt-pizza-service/blob/main/.github/workflows/claude-review.yml) into `.github/workflows/` and [REVIEW.md](https://github.com/isaacsmith3/jwt-pizza-service/blob/main/REVIEW.md) into the repository root.
4. Open a pull request. The review runs automatically, and runs again every time you push a new commit to the PR.

### Results

I ran two experiments on my codebase:
1. A negative test where I intentionally added SQL injection to the pull request, and the code review found it.

Pull request: https://github.com/isaacsmith3/jwt-pizza-service/pull/2

I added a "menu search" feature that put the search text straight into the SQL query. Before opening the PR, I tested it locally, and searching for `zzz%' UNION SELECT id, email, password, name, 0 FROM user -- ` returned 1,012 rows of user emails and password hashes. The reviewer marked it **Critical**, requested changes, and gave the right fix (use `?` placeholders). It also found the same bug that already existed in `updateUser`. I obviously didn't merge this code, but this would have helped me catch a SQL injection error that would have leaked every user's password hash from the JWT Pizza service. It helped me find it before the bug or the threat was discovered in production.

2. I made a fix that I knew was incomplete on purpose, to see if the reviewer would catch what I left out.

Pull request: https://github.com/isaacsmith3/jwt-pizza-service/pull/3

This was a pull request that I ultimately merged. Before it, the route to delete a franchise had no authentication at all, so anyone could delete any franchise with a `curl` request. My first commit only required a login, but didn't check that the user was an admin, so any diner could still delete any franchise. Claude requested changes with a **High** finding for the missing admin check and a **Medium** finding for the missing test. I fixed both and pushed again. On the re-review, Claude flagged nothing. I marked "fixed" on the old comments and merged the pull request!

| PR | Planted problem | Caught? | Severity given | Review time |
|---|---|---|---|---|
| #2 | SQL injection in menu search | Yes | Critical | 35s |
| #3, round 1 | Login check but no admin check | Yes | High | 34s |
| #3, round 2 | None (the real fix) | Correctly found nothing | n/a | 32s |

## What I learned

Overall, I learned that the way that software is being built is fundamentally changing. I know that AI is a good tool used for catching bugs before they are released into production. It is a way that we can ensure that our software is safer and more secure, and we can be more confident in merging them without the fear of having to roll back or revert our changes as often as we think we would.

It wasn't perfect, though:
- In PR #2, it found the SQL injection I planted and the existing one in `updateUser`, but it missed a third one in `getFranchises` (the `limit` value). It even pointed to `getFranchises` as the safe example to copy.
- It didn't always follow its own rules. The PR #2 summary said "0 Pre-existing" right after listing a pre-existing finding, and it rated "any user can delete franchises" as High even though my REVIEW.md defines a security hole as Critical.

It was very fun to explore something that the company that I work for is already doing, apply it to a project of my own, and add it to something that is relevant in school. It is still important that humans read code and understand how it works, so that you can know what the changes are that are being made and know how to understand if the review that the agent does is wrong. The missed `getFranchises` bug is a good example of that. Sometimes, in my work at Redo, I actually ignore or decide to push off the review that agents do because I know that they're not necessarily important right now.

Software is getting much cheaper and faster to make in today's world. I believe that learning how to use machines to automate the review and development of software will be a skill that is necessary in the coming days, because those that leverage these tools to move faster, quicker, and safer will get much further ahead.