import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://ydcrfvfrpsiwoutoobeh.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Nn026caGYDeJVLQK2HMY0w_V88XutD8";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ---- stages
export async function fetchStages(){
  const { data, error } = await sb
    .from("stages")
    .select("*")
    .order("sort_order", { ascending:true });

  if(error) throw error;
  return data ?? [];
}

// ---- deals
export async function fetchDeals(){
  const { data, error } = await sb
    .from("deals")
    .select("*, companies(name)")
    .order("updated_at", { ascending:false });

  if(error) throw error;
  return data ?? [];
}

export async function createDeal(payload){
  const { data, error } = await sb
    .from("deals")
    .insert(payload)
    .select("*")
    .single();

  if(error) throw error;
  return data;
}

export async function updateDeal(id, patch){
  const { data, error } = await sb
    .from("deals")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if(error) throw error;
  return data;
}

export async function deleteDeal(id){
  const { error } = await sb.from("deals").delete().eq("id", id);
  if(error) throw error;
  return true;
}

// ---- companies
export async function fetchCompanies(){
  const { data, error } = await sb
    .from("companies")
    .select("*")
    .order("updated_at", { ascending:false });

  if(error) throw error;
  return data ?? [];
}

export async function createCompany(payload){
  const { data, error } = await sb
    .from("companies")
    .insert(payload)
    .select("*")
    .single();

  if(error) throw error;
  return data;
}

export async function updateCompany(id, patch){
  const { data, error } = await sb
    .from("companies")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if(error) throw error;
  return data;
}

export async function deleteCompany(id){
  const { error } = await sb
    .from("companies")
    .delete()
    .eq("id", id);

  if(error) throw error;
  return true;
}

// ---- contacts
export async function fetchContacts(companyId=null){
  let q = sb
    .from("contacts")
    .select("*")
    .order("updated_at", { ascending:false });

  if(companyId) q = q.eq("company_id", companyId);

  const { data, error } = await q;
  if(error) throw error;
  return data ?? [];
}

export async function createContact(payload){
  const { data, error } = await sb
    .from("contacts")
    .insert(payload)
    .select("*")
    .single();

  if(error) throw error;
  return data;
}

export async function updateContact(id, patch){
  const { data, error } = await sb
    .from("contacts")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if(error) throw error;
  return data;
}

export async function deleteContact(id){
  const { error } = await sb.from("contacts").delete().eq("id", id);
  if(error) throw error;
  return true;
}

// ---- activities
export async function fetchActivitiesByDeal(dealId){
  const { data, error } = await sb
    .from("activities")
    .select("*")
    .eq("deal_id", dealId)
    .order("occurred_at", { ascending:false });

  if(error) throw error;
  return data ?? [];
}

export async function createActivity(payload){
  const { data, error } = await sb
    .from("activities")
    .insert(payload)
    .select("*")
    .single();

  if(error) throw error;
  return data;
}

// ---- tasks
export async function fetchTasksByDeal(dealId){
  const { data, error } = await sb
    .from("tasks")
    .select("*")
    .eq("deal_id", dealId)
    .order("created_at", { ascending:false });

  if(error) throw error;
  return data ?? [];
}

export async function createTask(payload){
  const { data, error } = await sb
    .from("tasks")
    .insert(payload)
    .select("*")
    .single();

  if(error) throw error;
  return data;
}

export async function updateTask(id, patch){
  const { data, error } = await sb
    .from("tasks")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();

  if(error) throw error;
  return data;
}

// ---- export
export function toCSV(rows){
  if(!rows?.length) return "";
  const cols = Object.keys(rows[0]);
  const esc = (v) => `"${String(v ?? "").replaceAll('"','""')}"`;
  const head = cols.map(esc).join(",");
  const body = rows.map(r => cols.map(c => esc(r[c])).join(",")).join("\n");
  return head + "\n" + body;
}
// ---- stages (추가)
export async function createStages(rows){
  // rows: [{name, sort_order}, ...]
  const { data, error } = await sb
    .from("stages")
    .insert(rows)
    .select("*");

  if(error) throw error;
  return data ?? [];
}
