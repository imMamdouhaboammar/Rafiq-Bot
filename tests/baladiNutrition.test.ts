import { test, expect } from 'bun:test';
import { calculateBaladiMeal, BALADI_FOOD_DATABASE } from '../services/tools/baladiNutritionTool.js';

test('BaladiNutritionTool: database contains core Egyptian staples', () => {
  expect(BALADI_FOOD_DATABASE['koshary_medium']).toBeDefined();
  expect(BALADI_FOOD_DATABASE['ful_plain']).toBeDefined();
  expect(BALADI_FOOD_DATABASE['taameya_sandwich']).toBeDefined();
  expect(BALADI_FOOD_DATABASE['baladi_bread']).toBeDefined();
  expect(BALADI_FOOD_DATABASE['gebna_areesh']).toBeDefined();
  expect(BALADI_FOOD_DATABASE['boiled_egg']).toBeDefined();
});

test('BaladiNutritionTool: calculates full koshary meal calories & macros', () => {
  const result = calculateBaladiMeal(['koshary_medium', 'boiled_egg']);
  
  expect(result.items.length).toBe(2);
  expect(result.totalCalories).toBe(750 + 75);
  expect(result.totalProtein).toBeCloseTo(22 + 6.3, 1);
  expect(result.totalCarbs).toBeCloseTo(130 + 0.6, 1);
  expect(result.coachAdvice).toBeDefined();
});

test('BaladiNutritionTool: calculates gym breakfast (ful + eggs + baladi bread)', () => {
  const result = calculateBaladiMeal(['ful_olive_oil', 'boiled_egg', 'baladi_bread']);

  expect(result.items.length).toBe(3);
  expect(result.totalCalories).toBe(260 + 75 + 250);
  expect(result.totalProtein).toBeGreaterThan(25);
  expect(result.coachAdvice).toContain('وحش');
});
