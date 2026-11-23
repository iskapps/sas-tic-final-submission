# SAS Final-Stage Submission — Hardi Fichardt

Live: https://iskapps.github.io/sas-tic-final-submission/

## Add evidence under each step

1. Open the site and click **Edit evidence** (or add `?edit=1` to the URL).
2. On any step, add:
   - **Text note**
   - **Photo** (drag-drop or browse)
   - **Video file** or **Paste video link** (YouTube / Drive)
3. Drafts save in your browser (`localStorage`).
4. Click **Export evidence.json**, replace the file in this folder, then:

```bash
git add evidence.json && git commit -m "Update evidence" && git push
```

For large videos, paste an unlisted YouTube link instead of uploading the file.

You can also set the main Task 1 embed in `config.js` → `videoEmbedUrl`.

## Design note

Visual direction inspired by [Sparkline landing (Dribbble)](https://dribbble.com/shots/26455331-Landing-Page-for-a-Data-Driven-Analytics-Platform): light shell, pill nav, yellow word-mark, blue CTA, step tiles.
