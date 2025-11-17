<template>
  <div class="w-full h-full overflow-y-auto bg-white dark:bg-gray-900">
    <div class="max-w-2xl mx-auto p-6">
      <div class="mb-6">
        <h2 class="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-2">
          Currency Converter
        </h2>
      </div>

      <div
        v-if="hasError"
        class="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
      >
        <p class="text-red-700 dark:text-red-300">
          <span class="font-semibold">Error:</span> {{ errorMessage }}
        </p>
      </div>

      <div v-else class="space-y-6">
        <!-- From Currency -->
        <div
          class="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30 rounded-lg p-6"
        >
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">From</div>
          <div class="flex items-baseline gap-3">
            <div class="text-4xl font-bold text-blue-600 dark:text-blue-400">
              {{ formatAmount(amount) }}
            </div>
            <div
              class="text-2xl font-semibold text-gray-700 dark:text-gray-300"
            >
              {{ from }}
            </div>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-500 mt-2">
            {{ getCurrencyName(from) }}
          </div>
        </div>

        <!-- Exchange Rate -->
        <div class="flex items-center justify-center">
          <div
            class="bg-gray-100 dark:bg-gray-800 rounded-full px-4 py-2 text-center"
          >
            <div class="text-xs text-gray-600 dark:text-gray-400 mb-1">
              Exchange Rate
            </div>
            <div
              class="font-mono text-sm font-semibold text-gray-800 dark:text-gray-200"
            >
              1 {{ from }} = {{ rate.toFixed(4) }} {{ to }}
            </div>
          </div>
        </div>

        <!-- To Currency -->
        <div
          class="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30 rounded-lg p-6"
        >
          <div class="text-sm text-gray-600 dark:text-gray-400 mb-2">To</div>
          <div class="flex items-baseline gap-3">
            <div class="text-4xl font-bold text-green-600 dark:text-green-400">
              {{ formatAmount(result) }}
            </div>
            <div
              class="text-2xl font-semibold text-gray-700 dark:text-gray-300"
            >
              {{ to }}
            </div>
          </div>
          <div class="text-xs text-gray-500 dark:text-gray-500 mt-2">
            {{ getCurrencyName(to) }}
          </div>
        </div>

        <!-- Timestamp -->
        <div class="text-center text-xs text-gray-500 dark:text-gray-500 pt-4">
          Exchange rates updated: {{ formatTimestamp(timestamp) }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import type { ToolResult } from "../types";
import type { CurrencyToolData } from "../models/currency";

const props = defineProps<{
  selectedResult: ToolResult<CurrencyToolData>;
}>();

const amount = computed(() => props.selectedResult.data?.amount || 0);
const from = computed(() => props.selectedResult.data?.from || "");
const to = computed(() => props.selectedResult.data?.to || "");
const rate = computed(() => props.selectedResult.data?.rate || 0);
const result = computed(() => props.selectedResult.data?.result || 0);
const timestamp = computed(() => props.selectedResult.data?.timestamp || "");
const errorMessage = computed(() => props.selectedResult.data?.error || "");
const hasError = computed(() => !!errorMessage.value);

const currencyNames: Record<string, string> = {
  USD: "US Dollar",
  EUR: "Euro",
  JPY: "Japanese Yen",
  GBP: "British Pound",
  CNY: "Chinese Yuan",
  CAD: "Canadian Dollar",
  AUD: "Australian Dollar",
  CHF: "Swiss Franc",
  INR: "Indian Rupee",
  KRW: "South Korean Won",
  MXN: "Mexican Peso",
  BRL: "Brazilian Real",
  ZAR: "South African Rand",
  SGD: "Singapore Dollar",
  HKD: "Hong Kong Dollar",
  SEK: "Swedish Krona",
  NOK: "Norwegian Krone",
  DKK: "Danish Krone",
  NZD: "New Zealand Dollar",
  RUB: "Russian Ruble",
};

function formatAmount(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function getCurrencyName(code: string): string {
  return currencyNames[code] || code;
}

function formatTimestamp(ts: string): string {
  if (!ts) return "Unknown";
  try {
    const date = new Date(ts);
    return date.toLocaleString();
  } catch {
    return ts;
  }
}
</script>
