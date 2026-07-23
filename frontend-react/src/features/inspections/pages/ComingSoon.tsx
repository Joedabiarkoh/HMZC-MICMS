import { EquipmentTypeConfig } from "../types/inspection.types";

interface Props {
  config: EquipmentTypeConfig;
}

/**
 * Same "coming soon" treatment used in the previous standalone tool for
 * Firefighting Equipment and Loose Gear & Lifting Equipment: the division
 * is selectable and structurally present, but shows a clear placeholder
 * instead of a checklist until HMZC supplies those check sheets.
 */
export default function ComingSoon({ config }: Props) {
  return (
    <div className="insp-coming-soon">
      <span className="insp-badge">{config.typeName.toUpperCase()} — COMING SOON</span>
      <h2>{config.typeName}</h2>
      <p>{config.divisionNote}</p>
      <p>
        This division is set up and ready in the app — vessel identification, statement, sign-off,
        and photo/signature capture will all work the same way as the other divisions the moment
        the checklist items are added.
      </p>
    </div>
  );
}
