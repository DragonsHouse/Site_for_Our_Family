with actor as (
  select id
  from family_members
  where role = 'owner' and status = 'active' and deleted_at is null
  order by created_at asc
  limit 1
),
product_rules(rule_key, name, description, rule_type, basis, amount, priority, stacking_policy, config) as (
  values
    ('base_salary_rank_01_egg', 'Base salary: Яйце дракона', 'Weekly base salary by canonical rank.', 'base_salary', 'rank', 0, 101, 'not_applicable', '{"minRank":1,"maxRank":1,"rankLabel":"Яйце дракона","productRule":"weekly_base_salary"}'::jsonb),
    ('base_salary_rank_02_mini', 'Base salary: Міні-Спопеляка', 'Weekly base salary by canonical rank.', 'base_salary', 'rank', 0, 102, 'not_applicable', '{"minRank":2,"maxRank":2,"rankLabel":"Міні-Спопеляка","productRule":"weekly_base_salary"}'::jsonb),
    ('base_salary_rank_03_smoketail', 'Base salary: Димохвіст', 'Weekly base salary by canonical rank.', 'base_salary', 'rank', 50000, 103, 'not_applicable', '{"minRank":3,"maxRank":3,"rankLabel":"Димохвіст","productRule":"weekly_base_salary"}'::jsonb),
    ('base_salary_rank_04_spark_scale', 'Base salary: Жаринка Луската', 'Weekly base salary by canonical rank.', 'base_salary', 'rank', 75000, 104, 'not_applicable', '{"minRank":4,"maxRank":4,"rankLabel":"Жаринка Луската","productRule":"weekly_base_salary"}'::jsonb),
    ('base_salary_rank_05_halfwing', 'Base salary: Півкрило Полум’я', 'Weekly base salary by canonical rank.', 'base_salary', 'rank', 100000, 105, 'not_applicable', '{"minRank":5,"maxRank":5,"rankLabel":"Півкрило Полум’я","productRule":"weekly_base_salary"}'::jsonb),
    ('base_salary_rank_06_rumble_scale', 'Base salary: Гримуча луска', 'Weekly base salary by canonical rank.', 'base_salary', 'rank', 125000, 106, 'not_applicable', '{"minRank":6,"maxRank":6,"rankLabel":"Гримуча луска","productRule":"weekly_base_salary"}'::jsonb),
    ('base_salary_rank_07_stormfire', 'Base salary: Буревогонь', 'Weekly base salary by canonical rank.', 'base_salary', 'rank', 150000, 107, 'not_applicable', '{"minRank":7,"maxRank":7,"rankLabel":"Буревогонь","productRule":"weekly_base_salary"}'::jsonb),
    ('base_salary_rank_08_crimson_dragons', 'Base salary: Багряні Дракони', 'Weekly base salary by canonical rank.', 'base_salary', 'rank', 200000, 108, 'not_applicable', '{"minRank":8,"maxRank":8,"rankLabel":"Багряні Дракони","productRule":"weekly_base_salary","canonicalMapping":"Багряні Дракони(Старійшини)"}'::jsonb),
    ('base_salary_rank_09_flame_keeper_deputy', 'Base salary: Хранитель полум’я / Зам', 'Weekly base salary by canonical rank.', 'base_salary', 'rank', 300000, 109, 'not_applicable', '{"minRank":9,"maxRank":9,"rankLabel":"Хранитель полум’я / Зам","productRule":"weekly_base_salary"}'::jsonb),
    ('base_salary_rank_10_head', 'Base salary: Голова', 'Weekly base salary by canonical rank.', 'base_salary', 'rank', 300000, 110, 'not_applicable', '{"minRank":10,"maxRank":10,"rankLabel":"Голова","productRule":"weekly_base_salary"}'::jsonb),

    ('premium_activity_3', 'Премія за активність: 3+ активності', 'Weekly general activity premium.', 'premium_rule', 'activity_metric', 50000, 203, 'highest_only', '{"metric":"overallActivityCount","minimum":3,"category":"activity","sourceType":"rule","productRule":"weekly_activity_premium"}'::jsonb),
    ('premium_activity_5', 'Премія за активність: 5+ активностей', 'Weekly general activity premium.', 'premium_rule', 'activity_metric', 100000, 205, 'highest_only', '{"metric":"overallActivityCount","minimum":5,"category":"activity","sourceType":"rule","productRule":"weekly_activity_premium"}'::jsonb),
    ('premium_activity_8', 'Премія за активність: 8+ активностей', 'Weekly general activity premium.', 'premium_rule', 'activity_metric', 150000, 208, 'highest_only', '{"metric":"overallActivityCount","minimum":8,"category":"activity","sourceType":"rule","productRule":"weekly_activity_premium"}'::jsonb),

    ('premium_quest_activity_3', 'Квестова премія: 3+ completed quests', 'Weekly quest activity premium, separate from direct quest payout.', 'premium_rule', 'activity_metric', 50000, 303, 'highest_only', '{"metric":"questsCompleted","minimum":3,"category":"quest_activity","sourceType":"rule","productRule":"weekly_quest_activity_premium"}'::jsonb),
    ('premium_quest_activity_5', 'Квестова премія: 5+ completed quests', 'Weekly quest activity premium, separate from direct quest payout.', 'premium_rule', 'activity_metric', 100000, 305, 'highest_only', '{"metric":"questsCompleted","minimum":5,"category":"quest_activity","sourceType":"rule","productRule":"weekly_quest_activity_premium"}'::jsonb),
    ('premium_quest_activity_8', 'Квестова премія: 8+ completed quests', 'Weekly quest activity premium, separate from direct quest payout.', 'premium_rule', 'activity_metric', 150000, 308, 'highest_only', '{"metric":"questsCompleted","minimum":8,"category":"quest_activity","sourceType":"rule","productRule":"weekly_quest_activity_premium"}'::jsonb),

    ('premium_combat_2', 'Бойова премія: 2+ вишки / стаки', 'Weekly combat premium from authoritative attendance.', 'premium_rule', 'activity_metric', 75000, 402, 'highest_only', '{"metric":"towerParticipation","minimum":2,"category":"combat","sourceType":"rule","productRule":"weekly_combat_premium"}'::jsonb),
    ('premium_combat_4', 'Бойова премія: 4+ вишки / стаки', 'Weekly combat premium from authoritative attendance.', 'premium_rule', 'activity_metric', 150000, 404, 'highest_only', '{"metric":"towerParticipation","minimum":4,"category":"combat","sourceType":"rule","productRule":"weekly_combat_premium"}'::jsonb),
    ('premium_combat_6', 'Бойова премія: 6+ вишки / стаки', 'Weekly combat premium from authoritative attendance.', 'premium_rule', 'activity_metric', 250000, 406, 'highest_only', '{"metric":"towerParticipation","minimum":6,"category":"combat","sourceType":"rule","productRule":"weekly_combat_premium"}'::jsonb),

    ('premium_leadership_successful_commander', 'Leadership premium: successful commander', 'Successful commander contribution on defended Tower Defense.', 'premium_rule', 'activity_metric', 75000, 500, 'not_applicable', '{"metric":"towerDefenseSuccessfulCommanded","minimum":1,"category":"leadership","sourceType":"rule","productRule":"successful_commander_bonus"}'::jsonb),

    ('premium_top_overall_1', 'TOP-1 overall weekly premium', 'Weekly monetary premium for overall leaderboard.', 'premium_rule', 'activity_metric', 300000, 601, 'highest_only', '{"metric":"overallLeaderboardRank","minimum":1,"maximum":1,"category":"top3","sourceType":"leaderboard","leaderboardCategory":"overall","productRule":"weekly_top3_overall_premium"}'::jsonb),
    ('premium_top_overall_2', 'TOP-2 overall weekly premium', 'Weekly monetary premium for overall leaderboard.', 'premium_rule', 'activity_metric', 200000, 602, 'highest_only', '{"metric":"overallLeaderboardRank","minimum":1,"maximum":2,"category":"top3","sourceType":"leaderboard","leaderboardCategory":"overall","productRule":"weekly_top3_overall_premium"}'::jsonb),
    ('premium_top_overall_3', 'TOP-3 overall weekly premium', 'Weekly monetary premium for overall leaderboard.', 'premium_rule', 'activity_metric', 100000, 603, 'highest_only', '{"metric":"overallLeaderboardRank","minimum":1,"maximum":3,"category":"top3","sourceType":"leaderboard","leaderboardCategory":"overall","productRule":"weekly_top3_overall_premium"}'::jsonb)
)
insert into family_salary_rules
  (rule_key, name, description, rule_type, basis, amount, currency, active, priority, stacking_policy, config, created_by_family_member_id)
select rule_key, name, description, rule_type, basis, amount, 'USD', true, priority, stacking_policy, config, actor.id
from product_rules
cross join actor
on conflict (rule_key) do update
  set name = excluded.name,
      description = excluded.description,
      rule_type = excluded.rule_type,
      basis = excluded.basis,
      amount = excluded.amount,
      currency = excluded.currency,
      active = excluded.active,
      priority = excluded.priority,
      stacking_policy = excluded.stacking_policy,
      config = excluded.config,
      updated_at = now();

update discord_role_mappings
set permissions = (
    select jsonb_agg(distinct permission)
    from jsonb_array_elements_text(discord_role_mappings.permissions || '["manage_treasury"]'::jsonb) as permission
  ),
  updated_at = now()
where discord_role_name = '🐉 Старші дракони'
  and mapping_type = 'additional_functional';
