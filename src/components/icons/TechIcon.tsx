import { TechSpecialty } from "~/types";

const techIcon: Record<TechSpecialty, string> = {
  BIOTIC: "/biotic.webp",
  CYBERNETIC: "/cybernetic.webp",
  WARFARE: "/warfare.webp",
  PROPULSION: "/propulsion.webp",
};

type Props = {
  techSpecialty: TechSpecialty;
  size?: number;
  /** Accessible label; defaults to the specialty name. */
  label?: string;
};

export function TechIcon({ techSpecialty, size = 20, label }: Props) {
  return (
    <img
      src={techIcon[techSpecialty]}
      style={{ width: size, verticalAlign: "middle" }}
      alt={label ?? techSpecialty}
      title={label}
    />
  );
}
