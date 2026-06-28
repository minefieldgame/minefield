export type Landmark = {
  name: string; city: string; country: string; latitude: number; longitude: number;
  imageUrl: string; imageAlt: string; sourceNote: string; imageValidation?: string;
};

const landmarkImage = (name: string, file: string) =>
  `/api/landmark-image?name=${encodeURIComponent(name)}&file=${encodeURIComponent(file)}`;
const sourceNote = "Image and location reference: Wikimedia Commons photograph";

const RAW: Array<[string,string,string,number,number,string]> = [
  ["Eiffel Tower","Paris","France",48.8584,2.2945,"Tour Eiffel Wikimedia Commons.jpg"],
  ["Statue of Liberty","New York","United States",40.6892,-74.0445,"Statue of Liberty 7.jpg"],
  ["Golden Gate Bridge","San Francisco","United States",37.8199,-122.4783,"Golden Gate Bridge as seen from Battery East.jpg"],
  ["Big Ben","London","United Kingdom",51.5007,-0.1246,"Big Ben 2012-1.jpg"],
  ["Colosseum","Rome","Italy",41.8902,12.4922,"Colosseo 2020.jpg"],
  ["Sagrada Família","Barcelona","Spain",41.4036,2.1744,"Sagrada Familia 01.jpg"],
  ["Brandenburg Gate","Berlin","Germany",52.5163,13.3777,"Brandenburg Gate at night.jpg"],
  ["Acropolis of Athens","Athens","Greece",37.9715,23.7257,"The Parthenon in Athens.jpg"],
  ["Neuschwanstein Castle","Schwangau","Germany",47.5576,10.7498,"Castle Neuschwanstein.jpg"],
  ["Leaning Tower of Pisa","Pisa","Italy",43.723,10.3966,"Leaning Tower of Pisa 2013.jpg"],
  ["Stonehenge","Wiltshire","United Kingdom",51.1789,-1.8262,"Stonehenge2007 07 30.jpg"],
  ["Christ the Redeemer","Rio de Janeiro","Brazil",-22.9519,-43.2105,"Cristo Redentor - Rio de Janeiro, Brasil.jpg"],
  ["Machu Picchu","Cusco Region","Peru",-13.1631,-72.545,"Machu Picchu, Peru.jpg"],
  ["Chichén Itzá","Yucatán","Mexico",20.6843,-88.5678,"Chichen Itza 3.jpg"],
  ["Moai of Easter Island","Rapa Nui","Chile",-27.125,-109.2767,"Moai Rano raraku.jpg"],
  ["CN Tower","Toronto","Canada",43.6426,-79.3871,"CN Tower seen from its base.jpg"],
  ["Space Needle","Seattle","United States",47.6205,-122.3493,"Space Needle002.jpg"],
  ["Mount Rushmore","Keystone","United States",43.8791,-103.4591,"Mount Rushmore detail view.jpg"],
  ["Gateway Arch","St. Louis","United States",38.6247,-90.1848,"Gateway Arch 2006.jpg"],
  ["Sydney Opera House","Sydney","Australia",-33.8568,151.2153,"Sydney Opera House Sails.jpg"],
  ["Uluru","Northern Territory","Australia",-25.3444,131.0369,"Uluru sunset1141.jpg"],
  ["Sky Tower","Auckland","New Zealand",-36.8485,174.7633,"Auckland Sky Tower.jpg"],
  ["Taj Mahal","Agra","India",27.1751,78.0421,"Taj Mahal, Agra, India edit3.jpg"],
  ["Gateway of India","Mumbai","India",18.9219,72.8347,"Mumbai 03-2016 41 Gateway of India.jpg"],
  ["Burj Khalifa","Dubai","United Arab Emirates",25.1972,55.2744,"Burj Khalifa.jpg"],
  ["Petra Treasury","Petra","Jordan",30.3285,35.4444,"The Treasury, Petra, Jordan.jpg"],
  ["Pyramids of Giza","Giza","Egypt",29.9792,31.1342,"All Gizah Pyramids.jpg"],
  ["Abu Simbel","Aswan","Egypt",22.3372,31.6258,"Abu Simbel, Ramesses Temple.jpg"],
  ["Hassan II Mosque","Casablanca","Morocco",33.6085,-7.6327,"Hassan II Mosque.jpg"],
  ["Table Mountain","Cape Town","South Africa",-33.9628,18.4098,"Table Mountain DanieVDM.jpg"],
  ["Great Mosque of Djenné","Djenné","Mali",13.9054,-4.555,"Great Mosque of Djenne 1.jpg"],
  ["Great Wall of China","Beijing","China",40.4319,116.5704,"The Great Wall of China at Jinshanling-edit.jpg"],
  ["Forbidden City","Beijing","China",39.9163,116.3972,"Forbidden City Beijing Shenwumen Gate.jpg"],
  ["Terracotta Army","Xi'an","China",34.3841,109.2785,"Terracotta Army, View of Pit 1.jpg"],
  ["Tokyo Tower","Tokyo","Japan",35.6586,139.7454,"Tokyo Tower and around Skyscrapers.jpg"],
  ["Fushimi Inari Shrine","Kyoto","Japan",34.9671,135.7727,"Fushimi Inari Taisha 2018.jpg"],
  ["Himeji Castle","Himeji","Japan",34.8394,134.6939,"Himeji Castle The Keep Towers.jpg"],
  ["Gyeongbokgung Palace","Seoul","South Korea",37.5796,126.977,"Gyeongbokgung-GeunJeongJeon.jpg"],
  ["Petronas Towers","Kuala Lumpur","Malaysia",3.1579,101.7117,"Petronas Panorama II.jpg"],
  ["Marina Bay Sands","Singapore","Singapore",1.2834,103.8607,"Marina Bay Sands in the evening - 20101120.jpg"],
  ["Angkor Wat","Siem Reap","Cambodia",13.4125,103.867,"Angkor Wat.jpg"],
  ["Ha Long Bay","Quảng Ninh","Vietnam",20.9101,107.1839,"Ha Long Bay in 2019.jpg"],
  ["Shwedagon Pagoda","Yangon","Myanmar",16.7983,96.1496,"Shwedagon Pagoda Yangon.jpg"],
  ["Borobudur","Magelang","Indonesia",-7.6079,110.2038,"Borobudur Temple.jpg"],
  ["Batu Caves","Selangor","Malaysia",3.2379,101.684,"Batu Caves, Lord Murugan Statue.jpg"],
  ["Grand Palace","Bangkok","Thailand",13.75,100.4913,"The Grand Palace of Bangkok.jpg"],
  ["Sheikh Zayed Grand Mosque","Abu Dhabi","United Arab Emirates",24.4128,54.4749,"Sheikh Zayed Mosque view.jpg"],
  ["Dome of the Rock","Jerusalem","Israel",31.778,35.2354,"Jerusalem Dome of the rock BW 14.jpg"],
  ["St. Basil's Cathedral","Moscow","Russia",55.7525,37.6231,"St Basils Cathedral-5007.jpg"],
  ["Hallgrímskirkja","Reykjavík","Iceland",64.142,-21.9266,"Hallgrimskirkja in Reykjavik.jpg"],
  ["Atomium","Brussels","Belgium",50.8949,4.3416,"Brussels Atomium.jpg"],
  ["Charles Bridge","Prague","Czechia",50.0865,14.4114,"Charles Bridge Prague.jpg"],
  ["Chain Bridge","Budapest","Hungary",47.4989,19.0436,"Budapest Chain Bridge.jpg"],
  ["Little Mermaid","Copenhagen","Denmark",55.6929,12.5993,"The Little Mermaid Copenhagen 2010.jpg"],
  ["Guggenheim Museum Bilbao","Bilbao","Spain",43.2687,-2.934,"Guggenheim-bilbao-jan05.jpg"]
];

export const LANDMARKS: Landmark[] = RAW.map(([name, city, country, latitude, longitude, file]) => ({
  name, city, country, latitude, longitude, imageUrl: landmarkImage(name, file),
  imageAlt: `${name} in ${city}, ${country}`, sourceNote,
  imageValidation: `Pinned Wikimedia Commons file: ${file}. Search fallback rejects illustrations, paintings, maps, logos, SVGs, and AI-art terms.`
}));
