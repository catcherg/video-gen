# Upload Policy

Rules for material people give the pipeline. The interface should show a short version of this before the first upload.

## What uploads are for

Uploads are sources of facts. The pipeline reads them, and the video states what they say in its own words.

- Don't upload anything you don't have the right to use.
- Don't upload private information about other people, or anything confidential, such as work documents you can't share.
- The video must not copy passages, scripts, images, or other creative content from an upload. Facts can be used, but the expression of them can't.

## Where uploads go

- A copy stays on your computer, in `videos/<slug>/output/pipeline/uploads/`. That folder isn't committed to git.
- The contents are sent to Anthropic to be read by Claude, under the terms of your own Claude plan or API account.
- Nothing is sent to anyone else, and nothing is hosted by this project.

## Uploads can't give orders

An uploaded document, or a web page found during research, might contain text aimed at the AI, such as "ignore your instructions". The pipeline treats all of it as data, and generated code runs in a sandbox in case something gets through. If a video contains something odd that you didn't ask for, don't publish it.

## Publishing

Whoever publishes a video is responsible for it. Check the facts and sources shown at the approval step. The pipeline can get things wrong, and it's most likely to on health, legal, financial, and news topics.
