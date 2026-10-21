import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import type { ReactNode } from "react";
import { DialogContent } from "@/components/ui/overlays";
import { Segmented } from "@/components/ui/segmented";
import { useApp, type Theme } from "@/state/store";
import { AskParts, AutoAdvanceRow, JumpRow, FontRow, OrderRow, PunctuationRow, ReciteStyleRow, Row, WholeWordRows } from "./controls";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="px-5 py-3">
      <h3 className="pt-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h3>
      <div className="divide-y">{children}</div>
    </section>
  );
}

export function SettingsDialog() {
  const theme = useApp((s) => s.settings.theme);
  const update = useApp((s) => s.updateSettings);

  return (
    <DialogContent title="Settings" description="Saved on this device.">
      <Section title="Naming the reference">
        <AskParts />
        <JumpRow />
      </Section>

      <Section title="Reciting">
        <ReciteStyleRow />
        <FontRow />
        <PunctuationRow />
        <WholeWordRows />
      </Section>

      <Section title="Practice">
        <OrderRow />
        <AutoAdvanceRow />
      </Section>

      <Section title="Appearance">
        <Row title="Theme">
          <Segmented<Theme>
            size="sm"
            value={theme}
            onChange={(theme) => update({ theme })}
            options={[
              { value: "light", label: <SunIcon />, title: "Light" },
              { value: "dark", label: <MoonIcon />, title: "Dark" },
              { value: "system", label: <MonitorIcon />, title: "System" },
            ]}
          />
        </Row>
      </Section>
      <div className="h-2" />
    </DialogContent>
  );
}
