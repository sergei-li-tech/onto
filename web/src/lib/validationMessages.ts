import { t as defaultTranslate, type TFunction } from "../i18n";
import type { ValidationIssue } from "./validate";

const SCHEMA_KEYWORDS = new Set([
  "required",
  "type",
  "enum",
  "additionalProperties",
  "pattern",
  "minLength",
  "minItems",
  "format",
]);

/**
 * Renders a validation issue in the interface language. Schema keywords are
 * mapped to localized phrases; values (ids, field names) stay as data.
 */
export function formatValidationIssue(
  issue: ValidationIssue,
  translate: TFunction = defaultTranslate,
): string {
  if (issue.code === "schema") {
    const key =
      issue.keyword && SCHEMA_KEYWORDS.has(issue.keyword)
        ? `validation.schema.${issue.keyword}`
        : "validation.schema.generic";
    return translate(key, {
      path: issue.path ?? "/",
      field: issue.field ?? "",
      type: issue.type ?? "",
    });
  }

  const id = issue.relationship ?? issue.action ?? issue.value ?? "";
  return translate(`validation.${issue.code}`, {
    id,
    entity: issue.entity ?? "",
    attribute: issue.attribute ?? "",
    value: issue.value ?? "",
  });
}

export function formatValidationIssues(
  issues: ValidationIssue[],
  translate?: TFunction,
): string[] {
  return issues.map((issue) => formatValidationIssue(issue, translate));
}
