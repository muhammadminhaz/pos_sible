import type { Rng } from "./rng";

export const FIRST_NAMES = [
  "Rahim", "Karim", "Abdul", "Mohammad", "Rafiq", "Jamal", "Kamal", "Hasan", "Hossain", "Sakib",
  "Tanvir", "Imran", "Arif", "Sohel", "Masud", "Nazmul", "Shahid", "Faruk", "Mizanur", "Anisur",
  "Fatema", "Ayesha", "Nusrat", "Sharmin", "Taslima", "Rokeya", "Jannat", "Sumaiya", "Nasrin", "Farzana",
  "Minhaz", "Tanmoy", "Rubel", "Babul", "Sabbir", "Riyad", "Shuvo", "Apu", "Mithu", "Liton",
] as const;

export const LAST_NAMES = [
  "Rahman", "Hossain", "Islam", "Ahmed", "Uddin", "Chowdhury", "Sarkar", "Mia", "Khan", "Haque",
  "Alam", "Akter", "Begum", "Sheikh", "Talukder", "Mollah", "Bhuiyan", "Mahmud", "Karim", "Das",
] as const;

export const SUPPLIER_BUSINESSES = [
  "Walton Distribution Hub", "Samsung Plaza Wholesale", "Xiaomi Authorized Distributor", "Symphony Trading",
  "Vision Electronics Depot", "Singer Bangladesh Ltd", "Transtec Supply Co", "Havit Imports",
  "Quality Feeds Ltd", "Nourish Poultry & Hatchery", "Aftab Feed Products", "Kazi Farms Feed Division",
  "Paragon Agro Ltd", "CP Bangladesh Co", "Mega Feed Ltd", "ACI Animal Health",
  "Hatim Traders", "Bismillah Enterprise", "Maa Babar Doa Traders", "Rupali Agro Supply",
] as const;

export const CUSTOMER_BUSINESSES = [
  "Rahman Electronics", "Madina Mobile Center", "Sonar Bangla Poultry", "Nabil Fish Farm",
  "Shapla Store", "Padma Agro", "Meghna Traders", "Jamuna Fisheries", "Bismillah Poultry Farm",
] as const;

export const AREAS = [
  { city: "Dhaka", state: "Dhaka", areas: ["Mirpur 10", "Dhanmondi 27", "Uttara Sector 7", "Mohammadpur", "Banani", "Badda", "Jatrabari", "Farmgate", "Motijheel", "Gulshan 1"] },
  { city: "Gazipur", state: "Dhaka", areas: ["Tongi", "Board Bazar", "Chowrasta"] },
  { city: "Narayanganj", state: "Dhaka", areas: ["Chashara", "Fatullah", "Siddhirganj"] },
  { city: "Savar", state: "Dhaka", areas: ["Hemayetpur", "Ashulia", "Bazar Road"] },
  { city: "Mymensingh", state: "Mymensingh", areas: ["Ganginarpar", "Trishal", "Bhaluka"] },
  { city: "Chattogram", state: "Chattogram", areas: ["Agrabad", "GEC Circle", "Halishahar"] },
  { city: "Cumilla", state: "Chattogram", areas: ["Kandirpar", "Chauddagram"] },
  { city: "Bogura", state: "Rajshahi", areas: ["Satmatha", "Sherpur"] },
] as const;

const OPERATORS = ["013", "014", "015", "016", "017", "018", "019"] as const;

export function mobile(r: Rng): string {
  return `${r.pick(OPERATORS)}${String(r.int(0, 99_999_999)).padStart(8, "0")}`;
}

export function personName(r: Rng): { first: string; last: string } {
  return { first: r.pick(FIRST_NAMES), last: r.pick(LAST_NAMES) };
}

export function address(r: Rng) {
  const a = r.pick(AREAS);
  return {
    line1: `House ${r.int(1, 120)}, Road ${r.int(1, 30)}`,
    line2: r.pick(a.areas),
    city: a.city,
    state: a.state,
    country: "Bangladesh",
    zip: String(r.int(1000, 9400)),
  };
}
