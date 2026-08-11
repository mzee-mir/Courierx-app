import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ImportsHomeScreen } from '../screens/imports/ImportsHomeScreen';
import { SelectCargoPartnerScreen } from '../screens/imports/SelectCargoPartnerScreen';
import { VirtualAddressScreen } from '../screens/imports/VirtualAddressScreen';
import { DeclareImportScreen } from '../screens/imports/DeclareImportScreen';
import { ImportDetailScreen } from '../screens/imports/ImportDetailScreen';



export type ImportsStackParamList = {
  ImportsHome: undefined;
  SelectPartner: undefined;
  VirtualAddress: { partner: any };
  DeclareImport: { partnerId: string, origin: string };
  ImportDetail: { importId: string };
};

const Stack = createNativeStackNavigator<ImportsStackParamList>();

export const ImportsStack = () => {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ImportsHome" component={ImportsHomeScreen} />
      <Stack.Screen name="SelectPartner" component={SelectCargoPartnerScreen} />
      <Stack.Screen name="VirtualAddress" component={VirtualAddressScreen} />
      <Stack.Screen name="DeclareImport" component={DeclareImportScreen} />
      <Stack.Screen name="ImportDetail" component={ImportDetailScreen} />
    </Stack.Navigator>
  );
};