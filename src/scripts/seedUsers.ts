import { v4 as uuidv4 } from 'uuid';
import { PasswordUtil } from '../utils/password';
import { pool, initDatabasePool } from '../config/database';
import { ResultSetHeader } from 'mysql2/promise';

async function seedAdminUsers() {
  initDatabasePool();

  console.log('Seeding initial administrative users...');

  const usersToSeed = [
    {
      publicId: uuidv4(),
      email: 'admin@anstaxconsultancy.com',
      password: 'Admin@ANS2026!',
      firstName: 'Abdulla',
      lastName: 'Shaikh',
      phone: '+91-7041512939',
      roleIds: [1, 2], // SUPER_ADMIN, ADMIN
    },
    {
      publicId: uuidv4(),
      email: 'consultant@anstaxconsultancy.com',
      password: 'Consultant@ANS2026!',
      firstName: 'Lead',
      lastName: 'Consultant',
      phone: '+91-9876543210',
      roleIds: [3], // CONSULTANT
    },
    {
      publicId: uuidv4(),
      email: 'staff@anstaxconsultancy.com',
      password: 'Staff@ANS2026!',
      firstName: 'Support',
      lastName: 'Staff',
      phone: '+91-9876543211',
      roleIds: [4], // STAFF
    },
  ];

  for (const u of usersToSeed) {
    const passwordHash = await PasswordUtil.hash(u.password);

    // Insert or update user
    await pool.query<ResultSetHeader>(
      `INSERT INTO users (public_id, email, password_hash, first_name, last_name, phone, status)
       VALUES (?, ?, ?, ?, ?, ?, 'ACTIVE')
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), status = 'ACTIVE'`,
      [u.publicId, u.email, passwordHash, u.firstName, u.lastName, u.phone]
    );

    // Fetch user ID
    const [userRows]: any = await pool.query('SELECT id FROM users WHERE email = ?', [u.email]);
    const userId = userRows[0]?.id;

    if (userId) {
      // Assign roles
      for (const roleId of u.roleIds) {
        await pool.query(
          `INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)`,
          [userId, roleId]
        );
      }
    }

    console.log(`✅ Seeded account: ${u.email} (Password: ${u.password})`);
  }

  console.log('Seeding complete.');
  await pool.end();
  process.exit(0);
}

seedAdminUsers().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
