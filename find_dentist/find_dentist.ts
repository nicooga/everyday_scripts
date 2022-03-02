import cheerio from "cheerio";
import axios, { AxiosResponse } from "axios";

const RAW_DOCTORS_LIST_URL =
  "https://www.hospitalaleman.org.ar/plan-medico/quiero-asociarme/cartillas-online/?ioutput=ajax&tab=4&esp=408&loc=403&q=&plan=111";

const GOOGLE_API_KEY = getEnv("GOOGLE_API_KEY");
const COOKIE = getEnv("COOKIE");
const MY_ADDRESS = getEnv("MY_ADDRESS");

main();

type Location = { lat: number; lng: number };

type Doctor = {
  name: string;
  address: string;
  phoneNumber: string;
  distanceFromMyself?: number;
  location?: Location;
};

type GeocodedDoctor = Doctor & { location: Location; };
type DoctorWithDistance = Doctor & { distanceFromMyself: number; };
type GeocodedDoctorWithDistance = GeocodedDoctor & DoctorWithDistance;

type GoogleGeocodeResponse = {
  results: {
    geometry: {
      location: { lat: number;
        lng: number;
      };
    };
  }[];
};

async function main(): Promise<void> {
  const doctors = await getDoctors();
  const geocodedDoctors = await geocodeDoctors(doctors);
  const myLocation = await getMyLocation();
  const doctorsWithDistance = calculateDistanceForDoctors(geocodedDoctors, myLocation)
  const sortedDoctors = sortByProximity(doctorsWithDistance);

  printDoctors(sortedDoctors);
}

function printDoctors(doctors: GeocodedDoctorWithDistance[]): void {
  doctors.forEach(doc => 
    console.log(`\
name: ${doc.name}
phone number: ${doc.phoneNumber}
address: ${doc.address}
distance: ${doc.distanceFromMyself}
===================================
`)
  );
}

async function geocodeDoctors(doctors: Doctor[]): Promise<GeocodedDoctor[]> {
  return Promise.all(doctors.map(geocodeDoctor));
}

async function geocodeDoctor(doctor: Doctor): Promise<GeocodedDoctor> {
  return {
    ...doctor,
    location: await geocode(doctor.address)
  };
}

async function geocode(address: string): Promise<Location> {
  const response = await axios.get<GoogleGeocodeResponse>(
    `https://maps.googleapis.com/maps/api/geocode/json`,
    { params: { address, key: GOOGLE_API_KEY } }
  );

  return response.data.results[0].geometry.location;
}

async function getMyLocation(): Promise<Location> { return geocode(MY_ADDRESS); }

function calculateDistanceForDoctors(doctors: GeocodedDoctor[], location: Location): (GeocodedDoctor & DoctorWithDistance)[] {
  return doctors.map(doc => ({
    ...doc,
    distanceFromMyself: distanceInKm(doc.location, location)
  }));
}

function sortByProximity<T extends DoctorWithDistance[]>(doctors: T): T {
  return doctors.sort((d1, d2) => {
    if (d1.distanceFromMyself > d2.distanceFromMyself) return 1;
    if (d1.distanceFromMyself < d2.distanceFromMyself) return -1;
    return 0;
  });
}

async function getDoctors(): Promise<Doctor[]> {
  const rawDoctorsListPage = await getRawDoctorsListPage(COOKIE);
  const html = rawDoctorsListPage.data;
  return parseDoctorsFromRawDoctorsListPage(html);
}

function parseDoctorsFromRawDoctorsListPage(html: string): Doctor[] {
  const $ = cheerio.load(html);

  const doctors = $("li.result").map((_index, el) => {
    const name = $(el).find("li.result .resultheader").text().replace(/\n/, " ").replace(/\s+/, "");
    const address = $(el).find(".pseudodt:contains('Dirección:') + .pseudodd").text();
    const phoneNumber = $(el).find(".pseudodt:contains('Tel.:') + .pseudodd").text();

    return { name, address, phoneNumber };
  }).toArray();

  if (doctors.length === 0) {
    console.log(html);
    throw new Error("No doctors could be parsed");
  }

  return doctors;
}

// The website protects from robots. Using a cookie fixes the problem so far.
async function getRawDoctorsListPage(cookie: string): Promise<AxiosResponse<string>> {
  return axios.get(RAW_DOCTORS_LIST_URL, {
    insecureHTTPParser: true,
    headers: {
      "Cache-Control": "no-cache",
      "Cookie": COOKIE
    }
  });
}

function distanceInKm(loc1: Location, loc2: Location): number {
  const EARTH_RADIUS = 6371;

  const dLat = deg2rad(loc2.lat-loc1.lat);
  const dLon = deg2rad(loc2.lng-loc1.lng); 

  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(deg2rad(loc1.lat)) * Math.cos(deg2rad(loc2.lat)) * 
    Math.sin(dLon/2) * Math.sin(dLon/2); 

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 

  return EARTH_RADIUS * c;
}

function deg2rad(deg: number): number { return deg * (Math.PI/180); }

function getEnv(name: string): string {
  const value = process.env[name];
  if (typeof  value !== "string") throw new Error("Missing env var " + name);
  return value;
}