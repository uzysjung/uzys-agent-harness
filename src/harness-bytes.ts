/**
 * 현재 번들이 어떤 자리에 까는 하네스 판의 바이트 (#911).
 *
 * 링크로 둔 자리(`.agents → dotfiles/agents`)에서 하네스가 못 되돌린 설치자 원본은 uninstall 화면이 `mv` 명령으로 안내한다. 그 명령이
 * 덮는 것이 **하네스가 놓은 바이트뿐** 이어야 한다 — 설치 기록은 남이 커밋한 파일이라 링크와 함께 위조해 "자산 이름" 의 자리를 설치자의
 * 다른 파일로 보낼 수 있다(`.agents → .` 면 `rules/git-policy.md`). 그래서 비교 대상은 기록(sha 포함)이 아니라 **번들 템플릿과 CLI 별
 * 변환**에서 구한다. 쓰는 쪽(install · update)과 같은 렌더 함수를 쓰므로 하네스가 실제로 놓는 바이트와 같다.
 *
 * 번들이 이 이름으로 까는 자리가 아니면 null — 이름이 자산이어야 한다는 문(`isRecordedTrackTarget` — manifest · 번들에 실재)도 여기서 건다.
 */

import { lstatSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import { renderAntigravityRule } from "./antigravity/transform.js";
import { renderBundledSkillFile } from "./codex/skills.js";
import { renderCodexHook } from "./codex/transform.js";
import { resolveBundleRoot } from "./context-cost.js";
import { hashContent, type InstallLog } from "./install-log.js";
import { isRecordedTrackTarget, recorded } from "./recorded.js";
import { portRules } from "./rules-port.js";

const CLAUDE_DIR = ".claude/";

export function harnessBytesAt(log: InstallLog, path: string): Buffer | null {
  const norm = posix.normalize(path);
  const root = resolveBundleRoot();
  const text = (rel: string): string => readFileSync(join(root, "templates", rel), "utf8");
  try {
    // 룰·훅·스킬은 세 CLI 가 한 번들에서 렌더한다 — 이름은 `.claude/` 쪽 이름으로 되짚어 manifest 에 묻는다
    const rule = /^\.agents\/rules\/([^/]+)\.md$/.exec(norm)?.[1];
    if (rule !== undefined) {
      const [ported] = isRecordedTrackTarget(log, `${CLAUDE_DIR}rules/${rule}.md`)
        ? portRules(root, [rule])
        : [];
      return ported === undefined ? null : Buffer.from(renderAntigravityRule(ported));
    }
    const hook = /^\.codex\/hooks\/([^/]+)$/.exec(norm)?.[1];
    if (hook !== undefined) {
      return isRecordedTrackTarget(log, `${CLAUDE_DIR}hooks/${hook}`)
        ? Buffer.from(renderCodexHook(text(`hooks/${hook}`)))
        : null;
    }
    const skill = /^\.agents\/skills\/([^/]+\/.+)$/.exec(norm)?.[1];
    if (skill !== undefined) {
      return isRecordedTrackTarget(log, `${CLAUDE_DIR}skills/${skill}`)
        ? Buffer.from(
            renderBundledSkillFile(skill.slice(skill.indexOf("/") + 1), text(`skills/${skill}`)),
          )
        : null;
    }
    // `.claude/` 는 번들 템플릿을 그대로 복사한다
    if (norm.startsWith(CLAUDE_DIR) && isRecordedTrackTarget(log, norm)) {
      return readFileSync(join(root, "templates", norm.slice(CLAUDE_DIR.length)));
    }
  } catch {
    /* 템플릿을 읽지 못하면 하네스 판을 알 수 없다 */
  }
  return null;
}

/**
 * 이 자리의 **현재 바이트**가 하네스가 놓은 것인가 — 현재 번들이 그 자리에 까는 판과 같거나, 그 자리에 적힌 기록 sha 와 같다(설치한 판보다
 * 새 판으로 지울 때 · 번들이 은퇴시킨 파일). 기록은 위조될 수 있지만 sha 를 맞추려면 위조자가 그 자리 파일의 바이트를 알아야 하고, 알 수
 * 있는 파일은 저장소가 추적하는 파일이라 되돌릴 수 있다. 말단이 링크이거나 읽을 수 없으면 아니다.
 */
export function holdsHarnessBytes(log: InstallLog, projectDir: string, path: string): boolean {
  const slot = join(projectDir, path);
  try {
    if (!lstatSync(slot).isFile()) return false;
    const disk = readFileSync(slot);
    const bundle = harnessBytesAt(log, path);
    if (bundle !== null && disk.equals(bundle)) return true;
    const rec = recorded(log, path);
    return rec.state === "sha" && rec.sha256 === hashContent(disk.toString("utf8"));
  } catch {
    return false;
  }
}
