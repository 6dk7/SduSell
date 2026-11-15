// Fills the database with demo users and listings.
// Usage: npm run seed            (only if the database is empty)
//        node server/seed.js --reset   (wipe listings/users first)
const { db } = require('./db');
const { hashPassword } = require('./auth');

if (process.argv.includes('--reset')) {
  db.exec('DELETE FROM favorites; DELETE FROM images; DELETE FROM listings; DELETE FROM sessions; DELETE FROM users;');
}
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) {
  console.log('Database already has data. Use --reset to wipe it first.');
  process.exit(0);
}

const addUser = db.prepare('INSERT INTO users (name, email, phone, city, password_hash) VALUES (?, ?, ?, ?, ?)');
const users = [
  ['Aigerim S.', 'demo@sdusell.kz', '+77011234567', 'Almaty'],
  ['Daniyar K.', 'daniyar@sdusell.kz', '+77022345678', 'Kaskelen'],
  ['Madina T.', 'madina@sdusell.kz', '+77033456789', 'Astana'],
].map((u) => Number(addUser.run(...u.slice(0, 4), hashPassword('password123')).lastInsertRowid));

const addListing = db.prepare(`INSERT INTO listings
  (user_id, title, description, search_text, price, category, city, condition, negotiable, views, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', ?))`);

// [user index, title, description, price KZT, category, city, condition, negotiable, views, age]
const items = [
  [0, 'iPhone 13 128GB, синий', 'Состояние отличное, батарея 91%. Полный комплект, чехол в подарок. Торг уместен.', 245000, 'Electronics', 'Almaty', 'used', 1, 142, '-1 hours'],
  [1, 'Ноутбук Lenovo IdeaPad 3, Ryzen 5', '16 GB RAM, SSD 512 GB. Для учёбы и программирования, лёгкий, держит 6 часов.', 215000, 'Electronics', 'Kaskelen', 'used', 1, 88, '-3 hours'],
  [2, 'Toyota Camry 2018, 2.5', 'Один владелец, не битая, пробег 78 000 км. Сервисная история в Toyota Центр.', 12900000, 'Transport', 'Astana', 'used', 1, 530, '-1 days'],
  [0, 'Горный велосипед Merida Big Nine', 'Рама L, 29", гидравлические тормоза. Катался два сезона, в хорошем состоянии.', 165000, 'Sports & Hobbies', 'Almaty', 'used', 1, 61, '-2 days'],
  [1, 'Учебник: Calculus, James Stewart (8th ed.)', 'Без пометок, почти новый. Подходит для первого курса. Self-pickup near SDU.', 9000, 'Books & Study', 'Kaskelen', 'used', 0, 47, '-2 days'],
  [2, 'Диван угловой, серый', 'Раскладной, ткань рогожка, есть ящик для белья. Самовывоз, помогу с погрузкой.', 130000, 'Home & Garden', 'Astana', 'used', 1, 73, '-3 days'],
  [0, 'Зимняя куртка The North Face, размер M', 'Тёплая, до -30. Носила один сезон. Химчистка сделана.', 38000, 'Fashion', 'Almaty', 'used', 1, 29, '-3 days'],
  [1, 'PlayStation 5 + 2 геймпада', 'Дисковая версия, 3 игры в комплекте (FIFA, Spider-Man, GoW). Гарантии нет, работает идеально.', 285000, 'Electronics', 'Shymkent', 'used', 1, 210, '-4 days'],
  [2, 'Детская коляска 2 в 1 Chicco', 'Зима/лето, москитная сетка и дождевик в комплекте. Состояние хорошее.', 55000, 'Kids', 'Astana', 'used', 1, 34, '-4 days'],
  [0, 'Репетитор по математике (школа/вуз)', 'Подготовка к ЕНТ, калькулюс, линейная алгебра. Онлайн или очно в Алматы. 5000 тг/час.', 5000, 'Services', 'Almaty', 'new', 0, 95, '-5 days'],
  [1, 'Монитор Samsung 27" 144Hz', 'IPS, подходит для игр и работы. Коробка есть, без битых пикселей.', 85000, 'Electronics', 'Karaganda', 'used', 1, 66, '-5 days'],
  [2, 'Гитара акустическая Yamaha F310', 'Отличный вариант для начинающих. В комплекте чехол и запасные струны.', 42000, 'Sports & Hobbies', 'Astana', 'used', 1, 41, '-6 days'],
  [0, 'MacBook Air M1 8/256', 'Цикл зарядки 180, без царапин. Зарядка и коробка в комплекте.', 330000, 'Electronics', 'Almaty', 'used', 1, 312, '-6 days'],
  [1, 'Стол письменный IKEA + кресло', 'Стол 140x60, кресло с регулировкой высоты. Заберу из общежития или доставлю по Каскелену.', 35000, 'Home & Garden', 'Kaskelen', 'used', 1, 52, '-7 days'],
  [2, 'Hyundai Elantra 2020', 'Автомат, 1.6, пробег 54 000. Без ДТП, второй владелец.', 8700000, 'Transport', 'Aktobe', 'used', 1, 421, '-7 days'],
  [0, 'Платье вечернее, размер S, новое', 'С биркой, покупала на свадьбу, не пригодилось. Цвет изумрудный.', 25000, 'Fashion', 'Almaty', 'new', 1, 38, '-8 days'],
  [1, 'Электросамокат Xiaomi Mi Pro 2', 'Запас хода ~40 км, пробег 600 км. Зарядка и документы есть.', 190000, 'Sports & Hobbies', 'Almaty', 'used', 1, 154, '-9 days'],
  [2, 'Набор Lego Technic', 'Собран один раз, все детали на месте, коробка сохранена.', 22000, 'Kids', 'Pavlodar', 'used', 0, 19, '-9 days'],
  [0, 'Курс английского IELTS, индивидуально', 'Преподаватель с IELTS 8.0. Подготовка к экзамену за 2-3 месяца.', 7000, 'Services', 'Almaty', 'new', 0, 77, '-10 days'],
  [1, 'Наушники Sony WH-1000XM4', 'Шумоподавление работает отлично. Коробка, кейс и кабель в комплекте.', 95000, 'Electronics', 'Taraz', 'used', 1, 103, '-11 days'],
  [2, 'Холодильник Samsung No Frost', 'Двухкамерный, высота 185 см, работает бесшумно. Самовывоз.', 150000, 'Home & Garden', 'Shymkent', 'used', 1, 58, '-12 days'],
  [0, 'Конспекты и шпаргалки по алгоритмам', 'Печатные и электронные, подготовка к экзамену по Data Structures.', 3000, 'Books & Study', 'Almaty', 'new', 0, 25, '-13 days'],
  [1, 'Приставка Nintendo Switch OLED', 'Белая, куплена в прошлом году. Две игры: Zelda и Mario Kart.', 175000, 'Electronics', 'Astana', 'used', 1, 118, '-14 days'],
];

for (const [ui, title, desc, price, cat, city, cond, neg, views, age] of items) {
  addListing.run(users[ui], title, desc, `${title} ${desc}`.toLowerCase(), price, cat, city, cond, neg, views, age);
}

console.log(`Seeded ${users.length} users and ${items.length} listings.`);
console.log('Demo login: demo@sdusell.kz / password123');
