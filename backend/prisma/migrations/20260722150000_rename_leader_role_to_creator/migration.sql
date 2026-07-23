-- Rename the LEADER role to CREATOR, keeping every existing user row's role intact.
ALTER TYPE "UserRole" RENAME VALUE 'LEADER' TO 'CREATOR';
