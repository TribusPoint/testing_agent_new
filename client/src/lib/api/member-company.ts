import { req } from "./client";
import type { MemberCompanyProfile } from "./types";

export function getMemberCompanyProfile() {
  return req<MemberCompanyProfile | null>("/api/member-company/profile");
}

export function completeMemberOnboarding(body: {
  company_name: string;
  company_url: string;
  industry: string;
}) {
  return req<MemberCompanyProfile>("/api/member-company/complete-onboarding", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function submitMemberCompanyEdit(body: {
  company_name: string;
  company_url: string;
  industry: string;
}) {
  return req<{ ok: boolean; message: string }>("/api/member-company/submit-edit-request", {
    method: "POST",
    body: JSON.stringify(body),
  });
}
