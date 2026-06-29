require('../server');
console.log('Database setup complete. Migrations applied and default owner seeded/updated when configured.');
setTimeout(() => process.exit(0), 100);
