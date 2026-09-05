type Page = "login" | "capture" | "result" | "record" | "log"

const STEPS: { id: Page; label: string }[] = [
  { id: "capture", label: "1 Capture" },
  { id: "result", label: "2 Call" },
  { id: "record", label: "3 Seal" },
  { id: "log", label: "4 Log" },
]

const ORDER: Record<Page, number> = { login: 0, capture: 1, result: 2, record: 3, log: 4 }

export function Steps(props: { page: Page; hasRecord: boolean; onGo: (page: Page) => void }) {
  if (props.page === "login") return null
  return (
    <nav className="steps" aria-label="Workflow">
      {STEPS.map((s) => {
        const needsRecord = s.id === "result" || s.id === "record"
        const locked = needsRecord && !props.hasRecord
        const current = s.id === props.page
        const done = !locked && !current && ORDER[s.id] < ORDER[props.page]

        let cls = ""
        if (current) cls = "on"
        else if (done) cls = "done"
        else if (locked) cls = "locked"

        return (
          <button
            key={s.id}
            type="button"
            className={cls}
            onClick={() => !locked && props.onGo(s.id)}
            aria-current={current ? "step" : undefined}
            aria-disabled={locked ? "true" : undefined}
          >
            {done ? "✓ " : ""}
            {s.label}
          </button>
        )
      })}
    </nav>
  )
}
