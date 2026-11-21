import type {
  AgentKnobs,
  Motivation,
  Proactivity,
  Seniority,
} from "@sandbox/shared";

type Props = {
  knobs: AgentKnobs;
  name: string;
  companyName: string;
  onKnobsChange: (knobs: AgentKnobs) => void;
  onNameChange: (name: string) => void;
  onCompanyChange: (company: string) => void;
  disabled?: boolean;
};

export function KnobsForm({
  knobs,
  name,
  companyName,
  onKnobsChange,
  onNameChange,
  onCompanyChange,
  disabled,
}: Props) {
  return (
    <div className="knobs-form">
      <label>
        Nombre del agente (opcional)
        <input
          value={name}
          placeholder="Dejar vacío para generar un título"
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label>
        Empresa de referencia (opcional)
        <input
          value={companyName}
          placeholder="Por ejemplo: Buk / Acme LatAm"
          onChange={(e) => onCompanyChange(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label>
        Nivel de experiencia
        <select
          value={knobs.seniority}
          onChange={(e) =>
            onKnobsChange({
              ...knobs,
              seniority: e.target.value as Seniority,
            })
          }
          disabled={disabled}
        >
          <option value="junior">Inicial</option>
          <option value="mid">Intermedio</option>
          <option value="senior">Avanzado</option>
          <option value="staff">Especialista</option>
        </select>
      </label>
      <label>
        Motivación
        <select
          value={knobs.motivation}
          onChange={(e) =>
            onKnobsChange({
              ...knobs,
              motivation: e.target.value as Motivation,
            })
          }
          disabled={disabled}
        >
          <option value="quality">Calidad</option>
          <option value="speed">Rapidez</option>
          <option value="compliance">Cumplimiento</option>
          <option value="impact">Impacto</option>
          <option value="recognition">Reconocimiento</option>
        </select>
      </label>
      <label>
        Proactividad
        <select
          value={knobs.proactivity}
          onChange={(e) =>
            onKnobsChange({
              ...knobs,
              proactivity: e.target.value as Proactivity,
            })
          }
          disabled={disabled}
        >
          <option value="low">Baja — espera instrucciones</option>
          <option value="medium">Media — propone el siguiente paso</option>
          <option value="high">Alta — impulsa la resolución</option>
        </select>
      </label>
    </div>
  );
}
