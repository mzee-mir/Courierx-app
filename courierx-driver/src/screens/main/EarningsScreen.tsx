import React, { useState, useCallback } from 'react';
import { 
  View, Text, StyleSheet, ScrollView, TouchableOpacity, 
  ActivityIndicator, RefreshControl, FlatList 
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { DollarSign, TrendingUp, History, ChevronLeft, PackageCheck } from 'lucide-react-native';
import { format, isToday } from 'date-fns';
import { api } from '../../api/client';

export const EarningsScreen = ({ navigation }: any) => {
  const [balance, setBalance] = useState(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchFinancials = async () => {
    try {
      const [balRes, transRes] = await Promise.all([
        api.get('/wallet/balance'),
        api.get('/wallet/transactions')
      ]);
      setBalance(balRes.data.balance);
      setTransactions(transRes.data.transactions);
    } catch (err) {
      console.error("EARNINGS_FETCH_ERROR", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchFinancials();
    }, [])
  );

  // Logic: Sum up all 'completed' jobs for today
  const todaysTotal = transactions
    .filter(tx => isToday(new Date(tx.createdAt)) && tx.status === 'completed')
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const renderTransaction = ({ item }: { item: any }) => (
    <View style={styles.txCard}>
      <View style={styles.txIconBox}>
        <PackageCheck size={20} color="#059669" />
      </View>
      <View style={styles.txInfo}>
        <Text style={styles.txTitle}>Delivery Payment</Text>
        <Text style={styles.txDate}>{format(new Date(item.createdAt), 'HH:mm • MMM dd')}</Text>
      </View>
      <Text style={styles.txAmount}>+${Math.abs(item.amount).toFixed(2)}</Text>
    </View>
  );

  if (loading && !refreshing) return <View style={styles.centered}><ActivityIndicator color="#000" /></View>;

  return (
    <View style={styles.container}>
      {/* 1. Header Navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <ChevronLeft size={28} color="black" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Financial History</Text>
        <View style={{ width: 28 }} />
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => {setRefreshing(true); fetchFinancials();}} />}
      >
        {/* 2. Main Stats Board */}
        <View style={styles.statsBoard}>
          <Text style={styles.statsLabel}>Total Balance</Text>
          <Text style={styles.totalBalance}>${balance.toFixed(2)}</Text>
          
          <View style={styles.divider} />
          
          <View style={styles.row}>
            <View style={styles.statGroup}>
              <Text style={styles.statLabelSm}>EARNED TODAY</Text>
              <Text style={styles.statValue}>${todaysTotal.toFixed(2)}</Text>
            </View>
            <View style={styles.statGroup}>
              <Text style={styles.statLabelSm}>JOBS DONE</Text>
              <Text style={styles.statValue}>{transactions.filter(t => isToday(new Date(t.createdAt))).length}</Text>
            </View>
          </View>
        </View>

        {/* 3. Transaction Log */}
        <View style={styles.historySection}>
          <View style={styles.sectionHeader}>
            <History size={18} color="#6B7280" />
            <Text style={styles.sectionTitle}>Recent Payouts</Text>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Start your first job to see earnings!</Text>
            </View>
          ) : (
            transactions.map(tx => (
              <View key={tx._id}>{renderTransaction({ item: tx })}</View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { paddingTop: 60, paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'white', paddingBottom: 15 },
  headerTitle: { fontSize: 18, fontWeight: 'bold' },
  content: { padding: 20 },
  statsBoard: { backgroundColor: '#111827', borderRadius: 24, padding: 25, elevation: 5 },
  statsLabel: { color: '#9CA3AF', fontSize: 13, marginBottom: 5 },
  totalBalance: { color: 'white', fontSize: 42, fontWeight: '900' },
  divider: { height: 1, backgroundColor: '#374151', marginVertical: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  statGroup: { flex: 1 },
  statLabelSm: { color: '#6B7280', fontSize: 10, fontWeight: 'bold', letterSpacing: 1 },
  statValue: { color: '#10B981', fontSize: 20, fontWeight: 'bold', marginTop: 4 },
  historySection: { marginTop: 30 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: '#374151', marginLeft: 10 },
  txCard: { backgroundColor: 'white', padding: 16, borderRadius: 16, flexDirection: 'row', alignItems: 'center', marginBottom: 12, elevation: 1 },
  txIconBox: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#DCFCE7', justifyContent: 'center', alignItems: 'center' },
  txInfo: { flex: 1, marginLeft: 15 },
  txTitle: { fontSize: 15, fontWeight: 'bold', color: '#111827' },
  txDate: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  txAmount: { fontSize: 16, fontWeight: 'bold', color: '#059669' },
  empty: { alignItems: 'center', marginTop: 40 },
  emptyText: { color: '#9CA3AF' }
});