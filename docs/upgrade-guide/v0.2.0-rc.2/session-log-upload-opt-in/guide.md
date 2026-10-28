---
kind: upgrade-guide
description: "The DeepSeek session-log contribution is off by default; enable it explicitly to keep uploading."
---

# Session-log upload becomes opt-in

English | [中文](guide.zh.md)

## Change

In v0.2.0-rc.2, `@deepseek-ai/dsh-session-log-deepseek` mounted with its `enabled` key defaulting to `true`. Every request to the official DeepSeek API therefore carried a `dsh_session_log` suffix of the canonical Session log, and the response appended a `session-log-deepseek/delivery-accepted` record that advanced the watermark.

The next release defaults `enabled` to `false`. A profile that never set the key stops contributing the field and stops appending acceptance records, so an installation relying on the shipped default silently loses the upload after upgrading. Profiles that set `enabled: true` explicitly, including those written by the Web switch, keep uploading unchanged.

The request field is model-input metadata either way: turning it off changes request bytes, not what the model reads.

## Migration

1. To keep uploading, turn on **Settings → General → Upload Session Log when using the official model API** in the Web client. For a profile edited by hand, add the row to `$DSH_HOME/profiles/<name>/cordis.patch.yml`:

   ```yaml
   - id: session-log-deepseek
     config:
       enabled: true
   ```

2. Leave the row out to accept the new default. An existing `enabled: false` row is now redundant and can be deleted.

3. Confirm: restart `dsh web`, open Settings → General, and check the switch reads on when you enabled it. A hand-edited profile confirms by the same switch, which reports the resolved value.
