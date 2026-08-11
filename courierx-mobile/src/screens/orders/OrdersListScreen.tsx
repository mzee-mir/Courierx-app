import React, { useState, useEffect, useCallback } from 'react';
import { 
  View, Text, StyleSheet, FlatList, TouchableOpacity, 
  ActivityIndicator, RefreshControl, Alert 
} from 'react-native';
import { XCircle, Trash2, Package } from 'lucide-react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { format } from 'date-fns';
import { api } from '../../api/client';

export const OrdersListScreen = () => {
  const navigation = useNavigation<any>();
  const [orders, setOrders] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');
  
  // Pagination State
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);

  // -- Feature: Cache Invalidation (Refresh on Tab Focus) --
  useFocusEffect(
    useCallback(() => {
      handleInitialLoad();
    }, [activeTab])
  );

  const handleInitialLoad = () => {
    setPage(1);
    setHasMore(true);
    fetchOrders(1, true);
  };

  const fetchOrders = async (pageNum: number, isRefresh: boolean = false) => {
    if (loading || (!hasMore && !isRefresh)) return;
    
    setLoading(true);
    try {
      const response = await api.get(`/orders?page=${pageNum}&limit=10`);
      if (response.data.success) {
        const newOrders = response.data.orders;
        setOrders(prev => isRefresh ? newOrders : [...prev, ...newOrders]);
        setHasMore(response.data.pagination.hasMore);
      }
    } catch (err) {
      console.error("PAGE_FETCH_ERROR", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // -- Feature: Cancellation Policy --
  const handleCancelOrder = (orderId: string) => {
    Alert.alert(
      "Cancel Delivery",
      "Are you sure? You can only cancel before a driver accepts your request.",
      [
        { text: "Keep Order", style: "cancel" },
        { 
          text: "Confirm Cancel", 
          style: "destructive", 
          onPress: async () => {
            try {
              // Status transition to CANCELLED (logic in Step 3 backend)
              const res = await api.patch(`/orders/${orderId}/status`, { status: 'CANCELLED' });
              if (res.data.success) {
                handleInitialLoad(); // Invalidate cache and refresh
              }
            } catch (err: any) {
              Alert.alert("Error", err.response?.data?.error || "Could not cancel.");
            }
          } 
        }
      ]
    );
  };

  const handleDelete = (orderId: string) => {
  Alert.alert(
    "Delete Order?",
    "This will completely remove the request. This action cannot be undone.",
    [
      { text: "Cancel", style: "cancel" },
      { 
        text: "Delete", 
        style: "destructive", 
        onPress: async () => {
          try {
            const res = await api.delete(`/orders/${orderId}`);
            if (res.data.success) {
              // Refresh the list immediately (using the fetch logic from Step 12.4)
              handleInitialLoad(); 
            }
          } catch (err: any) {
            Alert.alert("Failed", err.response?.data?.message || "Could not delete.");
          }
        } 
      }
    ]
  );
};

  const loadMore = () => {
    if (hasMore && !loading) {
      const nextPage = page + 1;
      setPage(nextPage);
      fetchOrders(nextPage);
    }
  };

  const renderOrderItem = ({ item }: { item: any }) => {
    const isPending = item.status === 'PENDING';

    return (
      <View style={styles.orderCard}>
        <TouchableOpacity 
          style={styles.cardMain}
          onPress={() => navigation.navigate('OrderTracking', { orderId: item._id })}
        >
          <View style={styles.cardHeader}>
            <Text style={styles.statusText}>{item.status}</Text>
            <Text style={styles.dateText}>{format(new Date(item.createdAt), 'MMM dd')}</Text>

            {item.status === 'PENDING' && (
              <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.deleteBtn}>
                <Trash2 size={18} color="#EF4444" />
              </TouchableOpacity>
            )}

          </View>
          <Text style={styles.landmarkText} numberOfLines={1}>From: {item.pickupLandmark}</Text>
          <Text style={styles.landmarkText} numberOfLines={1}>To: {item.dropoffLandmark}</Text>
        </TouchableOpacity>

        {/* Cancellation UI Trigger */}
        {isPending && (
          <TouchableOpacity 
            style={styles.cancelButton} 
            onPress={() => handleCancelOrder(item._id)}
          >
            <XCircle size={16} color="#DC2626" />
            <Text style={styles.cancelText}>Cancel Request</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
      </View>

      <FlatList
        data={orders}
        renderItem={renderOrderItem}
        keyExtractor={item => item._id}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5} // Trigger when 50% from bottom
        ListFooterComponent={loading ? <ActivityIndicator style={{ margin: 20 }} /> : null}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleInitialLoad} />}
        contentContainerStyle={styles.listPadding}
        ListEmptyComponent={
          <View style={styles.empty}><Package size={40} color="#D1D5DB" /><Text>No orders yet</Text></View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { paddingTop: 60, paddingHorizontal: 20, marginBottom: 10 },
  title: { fontSize: 24, fontWeight: 'bold' },
  listPadding: { padding: 20 },
  orderCard: { backgroundColor: 'white', borderRadius: 16, marginBottom: 16, elevation: 1 },
  cardMain: { padding: 16 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  statusText: { fontWeight: 'bold', color: '#2563EB', fontSize: 12 },
  dateText: { color: '#9CA3AF', fontSize: 12 },
  landmarkText: { color: '#4B5563', fontSize: 14, marginBottom: 4 },
  cancelButton: { 
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', 
    padding: 12, borderTopWidth: 1, borderTopColor: '#F3F4F6' 
  },
  deleteBtn: {
    padding: 8,
    backgroundColor: '#FEF2F2', // Light red background
    borderRadius: 10,
  },
  cancelText: { color: '#DC2626', fontWeight: '600', marginLeft: 6, fontSize: 13 },
  empty: { alignItems: 'center', marginTop: 100 },
  centered: { flex: 1, justifyContent: 'center' }
});