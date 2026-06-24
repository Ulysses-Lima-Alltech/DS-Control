import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { COLORS } from '@/constants/colors';
import {
  useRegisterNewCropSeason,
  useUpdateCropSeasonById,
} from '@/mutations/crop-season.mutation';
import { useAuth } from '@/providers/auth.provider';
import { useGetAllCropSeasons } from '@/queries/crop-season.query';
import { useGetAllProducts } from '@/queries/product.query';
import { CropSeason } from '@/types/crop-season.type';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { isAdminRole } from '@/utils/user-role';

type CropSeasonFormState = {
  id?: string;
  name: string;
  startDate: string;
  endDate: string;
  productIds: string[];
};

const emptyForm: CropSeasonFormState = {
  name: '',
  startDate: '',
  endDate: '',
  productIds: [],
};

const todayYmd = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getCropSeasonStatusLabel = (cropSeason: CropSeason) => {
  const today = todayYmd();

  if (cropSeason.startDate <= today && cropSeason.endDate >= today) {
    return 'Atual';
  }

  if (cropSeason.endDate < today) {
    return 'Encerrada';
  }

  return 'Futura';
};

export default function BackofficeConfigurations() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [form, setForm] = useState<CropSeasonFormState>(emptyForm);

  const isAdmin = isAdminRole(user?.type);

  const {
    data: cropSeasonsData,
    isLoading: isLoadingCropSeasons,
    refetch,
  } = useGetAllCropSeasons(
    {
      page: '1',
      limit: '100',
      search: search.trim() || undefined,
    },
    { enabled: isAdmin }
  );

  const { data: productsData, isLoading: isLoadingProducts } = useGetAllProducts(
    {
      page: '1',
      limit: '1000',
    },
    { enabled: isAdmin }
  );

  const products = productsData?.data || [];
  const cropSeasons = cropSeasonsData?.data || [];

  const selectedProductNames = useMemo(() => {
    const selected = new Set(form.productIds);
    return products.filter((product) => selected.has(product.id)).map((product) => product.name);
  }, [form.productIds, products]);

  const invalidateCropSeasonQueries = async () => {
    await queryClient.invalidateQueries({ queryKey: ['crop-seasons'] });
  };

  const { mutate: createCropSeason, isPending: isCreating } = useRegisterNewCropSeason({
    onError: (error) => Alert.alert('Não foi possível criar a safra', error.message),
    onSuccess: async () => {
      setForm(emptyForm);
      await invalidateCropSeasonQueries();
      Alert.alert('Safra criada', 'A safra foi criada com sucesso.');
    },
  });

  const { mutate: updateCropSeason, isPending: isUpdating } = useUpdateCropSeasonById({
    onError: (error) => Alert.alert('Não foi possível atualizar a safra', error.message),
    onSuccess: async () => {
      setForm(emptyForm);
      await invalidateCropSeasonQueries();
      Alert.alert('Safra atualizada', 'A safra foi atualizada com sucesso.');
    },
  });

  const isSubmitting = isCreating || isUpdating;

  const toggleProduct = (productId: string) => {
    setForm((current) => {
      const exists = current.productIds.includes(productId);
      return {
        ...current,
        productIds: exists
          ? current.productIds.filter((id) => id !== productId)
          : [...current.productIds, productId],
      };
    });
  };

  const selectAllProducts = () => {
    setForm((current) => ({
      ...current,
      productIds: products.map((product) => product.id),
    }));
  };

  const startEdit = (cropSeason: CropSeason) => {
    setForm({
      id: cropSeason.id,
      name: cropSeason.name,
      startDate: cropSeason.startDate,
      endDate: cropSeason.endDate,
      productIds: cropSeason.products?.map((product) => product.id) || [],
    });
  };

  const submit = () => {
    const payload = {
      name: form.name.trim(),
      startDate: form.startDate.trim(),
      endDate: form.endDate.trim(),
      productIds: form.productIds,
    };

    if (form.id) {
      updateCropSeason({ id: form.id, ...payload });
      return;
    }

    createCropSeason(payload);
  };

  if (!isAdmin) {
    return (
      <View style={styles.blockedContainer}>
        <Ionicons name='lock-closed-outline' size={38} color={COLORS.gray} />
        <Text style={styles.blockedTitle}>Acesso restrito</Text>
        <Text style={styles.blockedText}>
          Configurações estão disponíveis apenas para usuários ADM/admin.
        </Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Configurações</Text>
        <Text style={styles.subtitle}>Gerencie safras e produtos usados nos filtros.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{form.id ? 'Editar safra' : 'Criar safra'}</Text>

        <Text style={styles.label}>Nome da safra</Text>
        <TextInput
          value={form.name}
          onChangeText={(name) => setForm((current) => ({ ...current, name }))}
          placeholder='Ex: Safra 2025/2026'
          style={styles.input}
        />

        <View style={styles.dateRow}>
          <View style={styles.dateField}>
            <Text style={styles.label}>Data inicial</Text>
            <TextInput
              value={form.startDate}
              onChangeText={(startDate) => setForm((current) => ({ ...current, startDate }))}
              placeholder='YYYY-MM-DD'
              style={styles.input}
            />
          </View>

          <View style={styles.dateField}>
            <Text style={styles.label}>Data final</Text>
            <TextInput
              value={form.endDate}
              onChangeText={(endDate) => setForm((current) => ({ ...current, endDate }))}
              placeholder='YYYY-MM-DD'
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.productHeader}>
          <Text style={styles.label}>Produtos da safra</Text>
          <TouchableOpacity onPress={selectAllProducts} disabled={products.length === 0}>
            <Text style={styles.linkText}>Selecionar todos</Text>
          </TouchableOpacity>
        </View>

        {isLoadingProducts ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size='small' color={COLORS.blue} />
            <Text style={styles.loadingText}>Carregando produtos...</Text>
          </View>
        ) : (
          <View style={styles.productWrap}>
            {products.map((product) => {
              const selected = form.productIds.includes(product.id);
              return (
                <TouchableOpacity
                  key={product.id}
                  onPress={() => toggleProduct(product.id)}
                  style={[styles.productChip, selected && styles.productChipActive]}
                >
                  <Text style={selected ? styles.productChipTextActive : styles.productChipText}>
                    {product.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        <Text style={styles.selectedProductsText} numberOfLines={2}>
          {selectedProductNames.length > 0
            ? `${selectedProductNames.length} produto(s): ${selectedProductNames.join(', ')}`
            : 'Nenhum produto selecionado.'}
        </Text>

        <View style={styles.actionsRow}>
          {form.id ? (
            <TouchableOpacity
              onPress={() => setForm(emptyForm)}
              style={[styles.actionButton, styles.secondaryButton]}
            >
              <Text style={styles.secondaryButtonText}>Cancelar</Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity
            onPress={submit}
            disabled={isSubmitting}
            style={[styles.actionButton, styles.primaryButton, isSubmitting && styles.disabled]}
          >
            <Text style={styles.primaryButtonText}>
              {isSubmitting ? 'Salvando...' : form.id ? 'Salvar alterações' : 'Criar safra'}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.card}>
        <View style={styles.listHeader}>
          <View style={{ flex: 1 }}>
            <Text style={styles.cardTitle}>Safras cadastradas</Text>
            <Text style={styles.helperText}>A busca usa o mesmo endpoint de safras da Web.</Text>
          </View>
          <TouchableOpacity onPress={() => refetch()} style={styles.refreshButton}>
            <Ionicons name='refresh' size={16} color={COLORS.blue} />
          </TouchableOpacity>
        </View>

        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder='Buscar safra...'
          style={styles.input}
        />

        {isLoadingCropSeasons ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator size='small' color={COLORS.blue} />
            <Text style={styles.loadingText}>Carregando safras...</Text>
          </View>
        ) : cropSeasons.length === 0 ? (
          <Text style={styles.emptyText}>Nenhuma safra encontrada.</Text>
        ) : (
          <View style={styles.cropSeasonList}>
            {cropSeasons.map((cropSeason) => (
              <View key={cropSeason.id} style={styles.cropSeasonItem}>
                <View style={{ flex: 1 }}>
                  <View style={styles.itemTitleRow}>
                    <Text style={styles.itemTitle}>{cropSeason.name}</Text>
                    <Text style={styles.statusBadge}>{getCropSeasonStatusLabel(cropSeason)}</Text>
                  </View>
                  <Text style={styles.itemText}>
                    {formatDateToDDMMYYYY(cropSeason.startDate)} até{' '}
                    {formatDateToDDMMYYYY(cropSeason.endDate)}
                  </Text>
                  <Text style={styles.itemText}>
                    {cropSeason.products?.length || 0} produto(s) vinculados
                  </Text>
                </View>

                <TouchableOpacity onPress={() => startEdit(cropSeason)} style={styles.editButton}>
                  <Ionicons name='create-outline' size={17} color={COLORS.blue} />
                  <Text style={styles.editButtonText}>Editar</Text>
                </TouchableOpacity>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
    paddingBottom: 36,
    gap: 14,
  },
  header: {
    gap: 4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.black,
  },
  subtitle: {
    fontSize: 13,
    color: COLORS.gray,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 14,
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: COLORS.black,
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.black,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 9,
    backgroundColor: COLORS.white,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: COLORS.black,
  },
  dateRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dateField: {
    flex: 1,
    gap: 6,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  linkText: {
    color: COLORS.blue,
    fontWeight: '800',
    fontSize: 12,
  },
  productWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  productChip: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: COLORS.white,
  },
  productChipActive: {
    backgroundColor: COLORS.lightblue,
    borderColor: COLORS.blue,
  },
  productChipText: {
    color: COLORS.black,
    fontSize: 12,
    fontWeight: '600',
  },
  productChipTextActive: {
    color: COLORS.blue,
    fontSize: 12,
    fontWeight: '800',
  },
  selectedProductsText: {
    color: COLORS.gray,
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 4,
  },
  actionButton: {
    borderRadius: 9,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  primaryButton: {
    backgroundColor: COLORS.blue,
  },
  secondaryButton: {
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    backgroundColor: COLORS.white,
  },
  primaryButtonText: {
    color: COLORS.white,
    fontWeight: '800',
  },
  secondaryButtonText: {
    color: COLORS.black,
    fontWeight: '800',
  },
  disabled: {
    opacity: 0.65,
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  helperText: {
    color: COLORS.gray,
    fontSize: 12,
    marginTop: 2,
  },
  refreshButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.lightgray,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
  },
  loadingText: {
    color: COLORS.gray,
    fontSize: 13,
  },
  emptyText: {
    color: COLORS.gray,
    fontSize: 13,
    paddingVertical: 8,
  },
  cropSeasonList: {
    gap: 10,
  },
  cropSeasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: COLORS.lightgray,
    borderRadius: 16,
    padding: 12,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  itemTitle: {
    color: COLORS.black,
    fontSize: 14,
    fontWeight: '800',
  },
  statusBadge: {
    color: COLORS.blue,
    backgroundColor: COLORS.lightblue,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    fontSize: 11,
    fontWeight: '800',
  },
  itemText: {
    color: COLORS.gray,
    fontSize: 12,
    marginTop: 3,
  },
  editButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 8,
    backgroundColor: COLORS.lightblue,
  },
  editButtonText: {
    color: COLORS.blue,
    fontWeight: '800',
    fontSize: 12,
  },
  blockedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: COLORS.background,
  },
  blockedTitle: {
    marginTop: 10,
    color: COLORS.black,
    fontSize: 18,
    fontWeight: '800',
  },
  blockedText: {
    marginTop: 6,
    color: COLORS.gray,
    fontSize: 13,
    textAlign: 'center',
  },
});
