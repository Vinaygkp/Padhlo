require('dotenv').config();
const dns = require('dns');

// Configure reliable DNS servers to prevent querySrv ECONNREFUSED on Windows
try {
  dns.setServers(['8.8.8.8', '8.8.4.4', '1.1.1.1', '1.0.0.1']);
} catch (dnsErr) {
  console.warn('DNS server override notice:', dnsErr.message);
}

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const { User } = require('./models');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/padhlo';
const ADMIN_EMAIL = process.env.ADMIN_INITIAL_EMAIL || 'admin@padhlo.edu';
const ADMIN_PASSWORD = process.env.ADMIN_INITIAL_PASSWORD || 'AdminPass@2026';
const ADMIN_NAME = process.env.ADMIN_INITIAL_NAME || 'College Administrator';

async function seedAdmin() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB at:', MONGODB_URI);

    const existingAdmin = await User.findOne({ email: ADMIN_EMAIL.toLowerCase() });
    if (existingAdmin) {
      console.log(`ℹ️ Admin already exists with email: ${ADMIN_EMAIL}`);
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, 10);
    const admin = new User({
      name: ADMIN_NAME,
      email: ADMIN_EMAIL.toLowerCase(),
      password: hashedPassword,
      role: 'ADMIN',
      avatar: 'AD',
    });

    await admin.save();
    console.log('✅ College Administrator account initialized successfully:');
    console.log(`   Email: ${ADMIN_EMAIL}`);
    console.log(`   Role: ADMIN`);
    console.log(`   Password: [Set as defined in ADMIN_INITIAL_PASSWORD]`);
    process.exit(0);
  } catch (err) {
    console.error('Error seeding admin:', err.message);
    process.exit(1);
  }
}

seedAdmin();
