// Données géographiques de Kinshasa (24 communes et quartiers principaux)

export const KINSHASA_DATA: Record<string, string[]> = {
  "Bandalungwa": ["Adoula", "Basoko", "Bisengo", "Makelele", "Tshibangu", "Moulaert"],
  "Barumbu": ["Bitshaku-Tshaku", "Kabwe", "Kasa-Vubu", "Ndolo"],
  "Bumbu": ["Lokolenge", "Matadi", "Mbamu", "Mombo", "Mvuzi"],
  "Gombe": ["Batetela", "Gare", "Gombe", "Halle de la Gombe", "Luka", "Ngaliema", "Royal", "Socimat"],
  "Kalamu": ["Kalamu", "Kaua", "Kimbangu", "Matonge", "Pinzi", "Yolo-Nord", "Yolo-Sud"],
  "Kasa-Vubu": ["Assossa", "Kasa-Vubu", "Lubumbashi", "Salongo"],
  "Kimbanseke": ["Biyela", "Esanga", "Kikimi", "Kimbanseke", "Kingasani", "Maluku", "Mokali"],
  "Kinshasa": ["Akwa", "Dendale", "Kinshasa", "Ngoma", "Pumbu", "Wenze"],
  "Kintambo": ["Jamaïque", "Kintambo", "Kitokimosi", "Lukunga", "Wenze"],
  "Kisenso": ["Amba", "Bikuku", "Kisenso", "Matete", "Mundongo", "Nsele"],
  "Lemba": ["Camp-Massamba", "Gombele", "Lemba", "Molo", "Salongo", "Super Lemba"],
  "Limete": ["Agricole", "Industriel", "Kingabwa", "Limete", "Matete", "Mombele", "Mososo", "Ndanu", "Résidentiel"],
  "Lingwala": ["Kabila", "Lingwala", "Paka-Djuma", "Singa"],
  "Makala": ["Kala", "Makala", "Mbagni", "Ngiri-Ngiri", "Sanze"],
  "Maluku": ["Bateke", "Maluku", "Mbankana", "Menkao"],
  "Masina": ["Abattoir", "Bikuku", "Iméra", "Mapela", "Masina", "Petro-Congo", "Siforco"],
  "Matete": ["Anunga", "Kinsaku", "Lokele", "Lukemi", "Matete", "Mutoto", "Pululu"],
  "Mont-Ngafula": ["By-Pass", "Cité Mama Mobutu", "Kindele", "Matadi Mayo", "Mitendi", "Ndjili Kilambu"],
  "Ndjili": ["Ndjili", "Quartier 1", "Quartier 2", "Quartier 3", "Quartier 4", "Quartier 5", "Quartier 6", "Quartier 7"],
  "Ngaba": ["Baobab", "Bulu", "Lolo", "Makala", "Mpila", "Ngaba", "Tshikapa"],
  "Ngaliema": ["Binza-Ipcn", "Binza-Météo", "Binza-Ozone", "Binza-Pigeon", "Camp Tshatshi", "Djelo-Binza", "Joli Parc", "Kinsuka", "Macampagne", "Ngaliema"],
  "Ngiri-Ngiri": ["24 Novembre", "Assossa", "Diomi", "Elengesa", "Ngiri-Ngiri"],
  "Nsele": ["Kinkole", "Mikondo", "Mpasa", "Nsele"],
  "Selembao": ["Badiadingi", "Herdi", "Kalunga", "Libération", "Selembao"],
};

export const KINSHASA_COMMUNES = Object.keys(KINSHASA_DATA).sort();
