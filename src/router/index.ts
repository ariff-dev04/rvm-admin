import { createRouter, createWebHistory } from 'vue-router';
import { supabase } from '../services/supabase'; // Import Supabase directly for speed

// Import your views
import Dashboard from '../views/Dashboard.vue';
import Withdrawals from '../views/Withdrawal.vue';
import Users from '../views/Users.vue';
import UserDetail from '../views/UserDetail.vue';
import MachineStatus from '../views/MachineStatus.vue';
import Login from '../views/Login.vue';
import AdminManager from '../views/AdminManager.vue';

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { 
      path: '/login', 
      name: 'login', 
      component: Login,
      meta: { hideSidebar: true, requiresAuth: false } // ✅ Public Page
    },
    {
      path: '/',
      name: 'dashboard',
      component: Dashboard,
      meta: { requiresAuth: true } // 🔒 Protected
    },
    {
      path: '/submissions',
      name: 'submissions',
      component: () => import('../views/Submissions.vue'),
      meta: { requiresAuth: true } // 🔒 Protected
    },
    {
      path: '/withdrawals',
      name: 'withdrawals',
      component: Withdrawals,
      meta: { requiresAuth: true } // 🔒 Protected
    },
    {
      path: '/users',
      name: 'users',
      component: Users,
      meta: { requiresAuth: true } // 🔒 Protected
    },
    {
      path: '/users/:id',
      name: 'userDetail',
      component: UserDetail,
      meta: { requiresAuth: true } // 🔒 Protected
    },
    {
      path: '/machines',
      name: 'machines',
      component: MachineStatus,
      meta: { requiresAuth: true } // 🔒 Protected
    },
    { 
      path: '/admins', 
      component: AdminManager,
      meta: { requiresAuth: true } // 🔒 Protected
    },
    {
      path: '/cleaning-logs',
      name: 'CleaningLogs',
      component: () => import('../views/CleaningLogs.vue'),
      meta: { requiresAuth: true } // 🔒 Protected
    }
  ]
});

// ------------------------------------------------------------------
// 🛡️ THE GATEKEEPER (Navigation Guard)
// ------------------------------------------------------------------
router.beforeEach(async (to, _from, next) => {
  const { data: { session } } = await supabase.auth.getSession();
  const requiresAuth = to.matched.some(record => record.meta.requiresAuth);
  const isLoginPage = to.name === 'login';

  if (requiresAuth && !session) {
    next({ name: 'login' });
  } else if (isLoginPage && session) {
    next({ name: 'dashboard' });
  } else if (requiresAuth && session) {
    // --- NEW CHECK START ---
    // Check if user is actually an admin before letting them in
    const { data: admin } = await supabase
      .from('app_admins')
      .select('role')
      .eq('email', session.user.email!)
      .single();

    if (!admin) {
      // User exists but is NOT an admin -> Kick to login
      await supabase.auth.signOut();
      next({ name: 'login' });
    } else {
      // User is admin -> Proceed
      next();
    }
    // --- NEW CHECK END ---
  } else {
    next();
  }
});

export default router;