import type { AgentProfile } from "@sandbox/shared";
import { MOTIVATION_LABELS, PROACTIVITY_LABELS, SENIORITY_LABELS, areaLabel } from "./labels";

type Props = {
  profile: AgentProfile;
  onChange: (profile: AgentProfile) => void;
};

export function ProfileEditor({ profile, onChange }: Props) {
  return (
    <div className="profile-editor">
      <div className="profile-meta">
        <span>
          {profile.title} · {areaLabel(profile.areaId)}
        </span>
        <span>
          {SENIORITY_LABELS[profile.knobs.seniority] ?? profile.knobs.seniority} ·{" "}
          {MOTIVATION_LABELS[profile.knobs.motivation] ?? profile.knobs.motivation} ·{" "}
          {PROACTIVITY_LABELS[profile.knobs.proactivity] ?? profile.knobs.proactivity}
        </span>
        <span>
          {profile.refinedByModel ? "Refinado con Haiku" : "Solo plantillas (sin IA)"}
        </span>
      </div>

      <label>
        Nombre
        <input
          value={profile.name}
          onChange={(e) => onChange({ ...profile, name: e.target.value })}
        />
      </label>

      <label>
        Contexto del sistema (entorno del agente)
        <textarea
          className="tall"
          value={profile.systemContext}
          onChange={(e) =>
            onChange({ ...profile, systemContext: e.target.value })
          }
        />
      </label>

      <label>
        Estilo de trabajo (un punto por línea)
        <textarea
          value={profile.operatingStyle.join("\n")}
          onChange={(e) =>
            onChange({
              ...profile,
              operatingStyle: e.target.value
                .split("\n")
                .map((l) => l.trim())
                .filter(Boolean),
            })
          }
        />
      </label>

      <label>
        Plantilla de objetivo o escenario
        <textarea
          value={profile.goalTemplate}
          onChange={(e) =>
            onChange({ ...profile, goalTemplate: e.target.value })
          }
        />
      </label>
    </div>
  );
}
