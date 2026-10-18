import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Modal, 
  TextInput, 
  FlatList 
} from 'react-native';
import { ChevronDown, Check, Search, GraduationCap } from 'lucide-react-native';
import { THEME } from '@/constants/theme';
import { BRANCHES, BranchCode } from '@/types';

interface BranchDropdownProps {
  selectedBranch?: BranchCode | '';
  onSelectBranch: (branch: BranchCode) => void;
  label?: string;
  placeholder?: string;
}

export const BranchDropdown: React.FC<BranchDropdownProps> = ({
  selectedBranch,
  onSelectBranch,
  label = 'Engineering Branch *',
  placeholder = 'Select your branch',
}) => {
  const [modalVisible, setModalVisible] = useState(false);
  const [search, setSearch] = useState('');

  const currentOption = selectedBranch ? BRANCHES.find((b) => b.code === selectedBranch) : undefined;

  const filteredBranches = BRANCHES.filter((b) =>
    b.name.toLowerCase().includes(search.toLowerCase()) ||
    b.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => setModalVisible(true)}
        style={styles.selectorButton}
      >
        <View style={styles.selectedContent}>
          {currentOption ? (
            <>
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{currentOption.code}</Text>
              </View>
              <Text style={styles.selectedName} numberOfLines={1}>
                {currentOption.name}
              </Text>
            </>
          ) : (
            <Text style={[styles.selectedName, { color: THEME.textTertiary }]} numberOfLines={1}>
              {placeholder}
            </Text>
          )}
        </View>

        <ChevronDown size={18} color={THEME.cyan} />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View style={styles.headerTitleRow}>
                <GraduationCap size={20} color={THEME.purple} />
                <Text style={styles.modalTitle}>Select College Branch</Text>
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
                <Text style={styles.closeText}>Close</Text>
              </TouchableOpacity>
            </View>

            {/* Search filter */}
            <View style={styles.searchBar}>
              <Search size={16} color={THEME.textTertiary} />
              <TextInput
                style={styles.searchInput}
                placeholder="Search CSE, ECE, Mechanical..."
                placeholderTextColor={THEME.textTertiary}
                value={search}
                onChangeText={setSearch}
              />
            </View>

            <FlatList
              data={filteredBranches}
              keyExtractor={(item) => item.code}
              showsVerticalScrollIndicator={false}
              renderItem={({ item }) => {
                const isSelected = item.code === selectedBranch;

                return (
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => {
                      onSelectBranch(item.code);
                      setModalVisible(false);
                    }}
                    style={[
                      styles.branchItem,
                      isSelected && styles.branchItemSelected,
                    ]}
                  >
                    <View style={styles.branchItemLeft}>
                      <View
                        style={[
                          styles.itemBadge,
                          isSelected && styles.itemBadgeSelected,
                        ]}
                      >
                        <Text
                          style={[
                            styles.itemBadgeText,
                            isSelected && styles.itemBadgeTextSelected,
                          ]}
                        >
                          {item.code}
                        </Text>
                      </View>

                      <Text
                        style={[
                          styles.itemName,
                          isSelected && styles.itemNameSelected,
                        ]}
                      >
                        {item.name}
                      </Text>
                    </View>

                    {isSelected && <Check size={18} color={THEME.cyan} />}
                  </TouchableOpacity>
                );
              }}
            />
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
    width: '100%',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.textSecondary,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  selectorButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1.2,
    borderColor: THEME.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  selectedContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  badge: {
    backgroundColor: THEME.purpleMuted,
    borderWidth: 1,
    borderColor: THEME.purple + '50',
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 10,
  },
  badgeText: {
    color: THEME.purple,
    fontSize: 11,
    fontWeight: '800',
  },
  selectedName: {
    fontSize: 14,
    color: THEME.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: '#000000B5',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: THEME.surfaceElevated,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '900',
    color: THEME.textPrimary,
  },
  closeBtn: {
    padding: 4,
  },
  closeText: {
    color: THEME.cyan,
    fontSize: 13,
    fontWeight: '700',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: THEME.surfaceCard,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 42,
    marginBottom: 14,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: THEME.textPrimary,
    fontSize: 13,
  },
  branchItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: THEME.surfaceCard,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.surfaceBorder,
  },
  branchItemSelected: {
    borderColor: THEME.cyan,
    backgroundColor: THEME.cyanMuted,
  },
  branchItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 10,
  },
  itemBadge: {
    backgroundColor: THEME.surfaceElevated,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: 6,
    marginRight: 10,
  },
  itemBadgeSelected: {
    backgroundColor: THEME.cyan,
  },
  itemBadgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.textSecondary,
  },
  itemBadgeTextSelected: {
    color: THEME.black,
  },
  itemName: {
    fontSize: 13,
    fontWeight: '600',
    color: THEME.textPrimary,
    flex: 1,
  },
  itemNameSelected: {
    color: THEME.white,
    fontWeight: '800',
  },
});
