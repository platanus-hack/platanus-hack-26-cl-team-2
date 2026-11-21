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
        Agent name (optional)
        <input
          value={name}
          placeholder="Leave blank for auto title"
          onChange={(e) => onNameChange(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label>
        Company hint (optional)
        <input
          value={companyName}
          placeholder="e.g. Buk / Acme LatAm"
          onChange={(e) => onCompanyChange(e.target.value)}
          disabled={disabled}
        />
      </label>
      <label>
        Seniority
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
          <option value="junior">Junior</option>
          <option value="mid">Mid</option>
          <option value="senior">Senior</option>
          <option value="staff">Staff</option>
        </select>
      </label>
      <label>
        Motivation
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
          <option value="quality">Quality</option>
          <option value="speed">Speed</option>
          <option value="compliance">Compliance</option>
          <option value="impact">Impact</option>
          <option value="recognition">Recognition</option>
        </select>
      </label>
      <label>
        Proactivity
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
          <option value="low">Low — wait for asks</option>
          <option value="medium">Medium — propose next step</option>
          <option value="high">High — drive to closure</option>
        </select>
      </label>
    </div>
  );
}
