-- Users profile table
create table if not exists profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  email text not null,
  phone text,
  class_level int default 8,
  plan text default 'free',
  pages_used int default 0,
  pages_reset_at timestamptz default now(),
  razorpay_subscription_id text,
  created_at timestamptz default now()
);

-- Question sets history
create table if not exists question_sets (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade,
  subject text,
  class_level int,
  pages_used int,
  question_types jsonb,
  questions jsonb,
  created_at timestamptz default now()
);

-- RLS
alter table profiles enable row level security;
alter table question_sets enable row level security;

create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on profiles for update using (auth.uid() = id);
create policy "Users can view own question sets" on question_sets for select using (auth.uid() = user_id);
create policy "Users can insert own question sets" on question_sets for insert with check (auth.uid() = user_id);

-- Function to create profile on signup
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into profiles (id, name, email, phone)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', 'User'),
    new.email,
    new.raw_user_meta_data->>'phone'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
