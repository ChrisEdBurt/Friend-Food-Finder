import Database from 'better-sqlite3'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dbPath = path.join(__dirname, 'restaurants.db')

const db = new Database(dbPath)

db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS restaurants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    cuisine TEXT NOT NULL,
    price_tier TEXT NOT NULL,
    average_meal_cost REAL NOT NULL,
    phone TEXT,
    website TEXT,
    menu_url TEXT,
    address TEXT,
    description TEXT
  );
`)

const seedRestaurants = [
  {
    name: 'The Pumphouse',
    cuisine: 'Seafood',
    price_tier: 'premium',
    average_meal_cost: 45,
    phone: '+64 7 838 1330',
    website: 'https://www.thepumphouse.co.nz',
    menu_url: 'https://www.thepumphouse.co.nz/menu',
    address: '1 River Road, Hamilton East',
    description: 'A Hamilton classic for seafood and riverside dining.',
  },
  {
    name: 'Mamma Rosa',
    cuisine: 'Italian',
    price_tier: 'mid',
    average_meal_cost: 28,
    phone: '+64 7 839 6188',
    website: 'https://www.mammarosa.co.nz',
    menu_url: 'https://www.mammarosa.co.nz/menu',
    address: '119 Victoria Street, Hamilton Central',
    description: 'Authentic Italian dishes in central Hamilton.',
  },
  {
    name: 'Pizza Corner',
    cuisine: 'Italian',
    price_tier: 'budget',
    average_meal_cost: 18,
    phone: '+64 7 837 4218',
    website: 'https://example.com/pizzacorner',
    menu_url: 'https://example.com/pizzacorner/menu',
    address: '67 Victoria Street, Hamilton Central',
    description: 'Budget-friendly pizza slices and simple Italian comfort food.',
  },
  {
    name: 'Tandoori House',
    cuisine: 'Indian',
    price_tier: 'mid',
    average_meal_cost: 26,
    phone: '+64 7 838 2927',
    website: 'https://www.tandoorihousehamilton.co.nz',
    menu_url: 'https://www.tandoorihousehamilton.co.nz/menu',
    address: '19 Victoria Street, Hamilton',
    description: 'Popular curries and Indian favourites.',
  },
  {
    name: 'Noodle Canteen',
    cuisine: 'Chinese',
    price_tier: 'budget',
    average_meal_cost: 18,
    phone: '+64 7 847 2435',
    website: 'https://www.noodlecanteen.co.nz',
    menu_url: 'https://www.noodlecanteen.co.nz/menu',
    address: '53A Victoria Street, Hamilton Central',
    description: 'Noodles and stir-fries at a great value.',
  },
  {
    name: 'The Green Room',
    cuisine: 'Healthy',
    price_tier: 'mid',
    average_meal_cost: 24,
    phone: '+64 7 838 7100',
    website: 'https://www.thegreenroomhamilton.co.nz',
    menu_url: 'https://www.thegreenroomhamilton.co.nz/menu',
    address: '2 Victoria Street, Hamilton Central',
    description: 'Fresh salads and wholesome plates.',
  },
  {
    name: 'Zanzibar',
    cuisine: 'Mediterranean',
    price_tier: 'mid',
    average_meal_cost: 29,
    phone: '+64 7 839 1981',
    website: 'https://www.zanzibar.co.nz',
    menu_url: 'https://www.zanzibar.co.nz/menu',
    address: '32 Barton Street, Hamilton Central',
    description: 'Mediterranean dishes and mezze.',
  },
  {
    name: 'Katsu Sushi',
    cuisine: 'Japanese',
    price_tier: 'mid',
    average_meal_cost: 31,
    phone: '+64 7 835 9955',
    website: 'https://www.katsusushi.co.nz',
    menu_url: 'https://www.katsusushi.co.nz/menu',
    address: '4A Victoria Street, Hamilton Central',
    description: 'Sushi and Japanese favourites.',
  },
  {
    name: 'Taco Del Mar',
    cuisine: 'Mexican',
    price_tier: 'budget',
    average_meal_cost: 20,
    phone: '+64 7 834 4567',
    website: 'https://www.tacodelmar.co.nz',
    menu_url: 'https://www.tacodelmar.co.nz/menu',
    address: '28 Victoria Street, Hamilton',
    description: 'Tacos and burritos for a casual meetup.',
  },
]

const seedDatabase = () => {
  db.exec('DELETE FROM restaurants')

  const insertRestaurant = db.prepare(`
    INSERT INTO restaurants (name, cuisine, price_tier, average_meal_cost, phone, website, menu_url, address, description)
    VALUES (@name, @cuisine, @price_tier, @average_meal_cost, @phone, @website, @menu_url, @address, @description)
  `)

  const insertMany = db.transaction((restaurants) => {
    restaurants.forEach((restaurant) => insertRestaurant.run(restaurant))
  })

  insertMany(seedRestaurants)
}

seedDatabase()

export function getRestaurants({ cuisine, maxPrice, partySize = 2 }) {
  const query = `
    SELECT * FROM restaurants
    WHERE cuisine = @cuisine
      AND average_meal_cost <= @maxPrice
      AND average_meal_cost * @partySize <= @maxPrice * @partySize
    ORDER BY name ASC
  `

  return db.prepare(query).all({ cuisine, maxPrice, partySize })
}

export function getAllRestaurants() {
  return db.prepare('SELECT * FROM restaurants ORDER BY name ASC').all()
}

export function getRestaurantById(id) {
  return db.prepare('SELECT * FROM restaurants WHERE id = ?').get(id)
}

export default db
