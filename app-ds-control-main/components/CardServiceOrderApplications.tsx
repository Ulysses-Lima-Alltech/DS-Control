import { View, Text, ActivityIndicator } from 'react-native';
import { Entypo, Feather, Ionicons } from '@expo/vector-icons';
import { COLORS } from '@/constants/colors';
import formatDateToDDMMYYYY from '@/utils/date-formatter';
import { SimpleLineIcons } from '@expo/vector-icons';
import { Octicons } from '@expo/vector-icons';
import { TouchableOpacity } from 'react-native';
import { useGetAllApplications } from '@/queries/application.query';
import { useAuth } from '@/providers/auth.provider';
import { Application } from '@/types/applications.type';
import { useState } from 'react';
import { useRouter } from 'expo-router';

export default function CardServiceOrderApplications({
  serviceOrderId,
}: {
  serviceOrderId: string;
}) {
  const router = useRouter();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: applicationsData,
    isFetching,
    isError,
    error,
  } = useGetAllApplications({
    pilotId: user?.type === 'pilot' ? user?.id : undefined,
    serviceOrderId: serviceOrderId,
    includePlots: 'true',
    page: currentPage.toString(),
    limit: '5',
  });

  if (isError) {
    return <SkeletonError error={error} />;
  }

  if (isFetching || !applicationsData || !user?.id) {
    return <SkeletonLoading />;
  }

  const applications: Application[] = applicationsData?.data ?? [];
  const totalPages = applicationsData?.totalPages ?? 1;
  const totalCount = applicationsData?.totalCount ?? 0;

  const handleFirstPage = () => setCurrentPage(1);
  const handlePreviousPage = () => setCurrentPage((prev) => Math.max(1, prev - 1));
  const handleNextPage = () => setCurrentPage((prev) => Math.min(totalPages, prev + 1));
  const handleLastPage = () => setCurrentPage(totalPages);

  return (
    <View
      style={{
        backgroundColor: COLORS.white,
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: COLORS.black,
        shadowOffset: {
          width: 0,
          height: 2,
        },
        shadowOpacity: 0.1,
        shadowRadius: 3.84,
        elevation: 5,
      }}
    >
      {user?.type === 'pilot' && (
        <TouchableOpacity
          style={{
            width: '100%',
            backgroundColor: COLORS.green,
            marginTop: 12,
            borderRadius: 8,
            padding: 8,
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 8,
            marginBottom: 12,
          }}
          onPress={() =>
            router.push(
              `/pilot/service-orders/form-application?serviceOrderId=${serviceOrderId}&formMode=new`
            )
          }
        >
          <Feather name='settings' size={14} color={COLORS.white} />
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: COLORS.white,
            }}
          >
            Adicionar nova aplicação
          </Text>
        </TouchableOpacity>
      )}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          marginBottom: 24,
          alignItems: 'center',
        }}
      >
        <View style={{ flex: 1, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          <Feather name='settings' size={16} color={COLORS.green} />
          <Text
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              color: COLORS.black,
              flex: 1,
              marginRight: 10,
            }}
          >
            Minhas aplicações
          </Text>
        </View>
        <View
          style={{
            backgroundColor: COLORS.lightgreen,
            borderRadius: 8,
            padding: 4,
            paddingHorizontal: 8,
          }}
        >
          <Text style={{ fontSize: 12, color: COLORS.green }}>
            {applicationsData.totalCount} aplicações
          </Text>
        </View>
      </View>

      {applications.map((application) => {
        return (
          <View
            key={application.id}
            style={{
              flexDirection: 'column',
              gap: 8,
              backgroundColor: COLORS.white,
              borderRadius: 8,
              padding: 12,
              marginBottom: 12,
              borderWidth: 1,
              borderColor: COLORS.lightgray,
            }}
          >
            <View
              style={{
                flexDirection: 'row',
              }}
            >
              {/* Coluna 1 */}
              <View
                style={{
                  flex: 1,
                  flexDirection: 'column',
                  gap: 8,
                  flexWrap: 'wrap',
                }}
              >
                {/* Coluna 1 - Linha 1 - Piloto */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='user' size={16} color={COLORS.blue} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Piloto</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.pilot?.name.split(' ')[0] || 'NÃO INFORMADO'}
                    </Text>
                  </View>
                </View>

                {/* Coluna 1 - Linha 2 - Drone */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='settings' size={16} color={COLORS.purple} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Drone</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.drone.name}
                    </Text>
                  </View>
                </View>

                {/* Coluna 1 - Linha 3 - Talhão */}
                {application.plot && (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Octicons name='stack' size={16} color={COLORS.purple} />
                    <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                      <Text style={{ fontSize: 12, color: COLORS.gray }}>Talhão</Text>
                      <Text
                        style={{
                          fontSize: 14,
                          color: COLORS.black,
                          fontWeight: 'bold',
                          textOverflow: 'ellipsis',
                          flexWrap: 'nowrap',
                        }}
                      >
                        {application.plot?.name || 'N/A'}
                      </Text>
                    </View>
                  </View>
                )}

                {/* Coluna 1 - Linha 4 - Vazão */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Entypo name='water' size={16} color={COLORS.blue} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Vazão</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.flowRate} L/ha
                    </Text>
                  </View>
                </View>

                {/* Coluna 1 - Linha 5 - Espaçamento de Rota */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='navigation' size={16} color={COLORS.green} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Espaçamento de Rota</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.routeSpacing} m
                    </Text>
                  </View>
                </View>

                {/* Coluna 1 - Linha 6 - Data */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='calendar' size={16} color={COLORS.green} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Data</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {formatDateToDDMMYYYY(application.date)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Coluna 2 */}
              <View
                style={{
                  flex: 1,
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {/* Coluna 2 - Linha 1 - Ajudante */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='user' size={16} color={COLORS.green} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Ajudante</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.assistant?.name.split(' ')[0] || 'NÃO INFORMADO'}
                    </Text>
                  </View>
                </View>

                {/* Coluna 2 - Linha 2 - Cultivo */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Ionicons name='leaf-outline' size={16} color={COLORS.orange} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Cultivo</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.culture.name}
                    </Text>
                  </View>
                </View>

                {/* Coluna 2 - Linha 3 - Hectares */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='target' size={16} color={COLORS.red} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Hectares</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.hectares} ha
                    </Text>
                  </View>
                </View>

                {/* Coluna 2 - Linha 4 - Altitude de Voo */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <SimpleLineIcons name='plane' size={16} color={COLORS.purple} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Altitude de Voo</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.altitude} m
                    </Text>
                  </View>
                </View>

                {/* Coluna 2 - Linha 5 - Tamanho de Gota */}
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Feather name='droplet' size={16} color={COLORS.orange} />
                  <View style={{ flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <Text style={{ fontSize: 12, color: COLORS.gray }}>Tamanho de Gota</Text>
                    <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                      {application.dropletSize} µm
                    </Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Observações */}
            {application.observations && (
              <View
                style={{
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  gap: 8,
                  marginTop: 16,
                  backgroundColor: COLORS.lightblue,
                  padding: 12,
                  borderRadius: 8,
                  borderColor: COLORS.lightgray,
                  borderWidth: 1,
                }}
              >
                <Text style={{ fontSize: 12, color: COLORS.gray }}>Observações</Text>
                <Text style={{ fontSize: 14, color: COLORS.black, fontWeight: 'bold' }}>
                  {application.observations}
                </Text>
              </View>
            )}

            {/* Edit Button */}
            {user?.type === 'pilot' && (
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  marginTop: 8,
                  gap: 10,
                  borderWidth: 1,
                  borderColor: COLORS.blue,
                  borderRadius: 8,
                  paddingVertical: 4,
                  justifyContent: 'center',
                  alignItems: 'center',
                  backgroundColor: COLORS.white,
                }}
                onPress={() => {
                  router.push(
                    `/pilot/service-orders/form-application?serviceOrderId=${serviceOrderId}&formMode=edit&applicationId=${application.id}`
                  );
                }}
              >
                <Feather
                  name='edit'
                  size={12}
                  color={COLORS.blue}
                  style={{ alignSelf: 'center' }}
                />
                <Text style={{ fontSize: 12, color: COLORS.blue }}>Editar</Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}

      {/* Pagination */}
      {totalPages > 1 && (
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginTop: 16,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: COLORS.lightgray,
          }}
        >
          {/* Pagination Info */}
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, color: COLORS.gray }}>
              Página {currentPage} de {totalPages} • {totalCount} aplicações
            </Text>
          </View>

          {/* Pagination Buttons */}
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {/* First Page Button */}
            <TouchableOpacity
              style={{
                backgroundColor: currentPage === 1 ? COLORS.lightgray : COLORS.green,
                borderRadius: 6,
                padding: 8,
                opacity: currentPage === 1 ? 0.5 : 1,
              }}
              onPress={handleFirstPage}
              disabled={currentPage === 1}
            >
              <Feather
                name='chevrons-left'
                size={16}
                color={currentPage === 1 ? COLORS.gray : COLORS.white}
              />
            </TouchableOpacity>

            {/* Previous Page Button */}
            <TouchableOpacity
              style={{
                backgroundColor: currentPage === 1 ? COLORS.lightgray : COLORS.green,
                borderRadius: 6,
                padding: 8,
                opacity: currentPage === 1 ? 0.5 : 1,
              }}
              onPress={handlePreviousPage}
              disabled={currentPage === 1}
            >
              <Feather
                name='chevron-left'
                size={16}
                color={currentPage === 1 ? COLORS.gray : COLORS.white}
              />
            </TouchableOpacity>

            {/* Next Page Button */}
            <TouchableOpacity
              style={{
                backgroundColor: currentPage === totalPages ? COLORS.lightgray : COLORS.green,
                borderRadius: 6,
                padding: 8,
                opacity: currentPage === totalPages ? 0.5 : 1,
              }}
              onPress={handleNextPage}
              disabled={currentPage === totalPages}
            >
              <Feather
                name='chevron-right'
                size={16}
                color={currentPage === totalPages ? COLORS.gray : COLORS.white}
              />
            </TouchableOpacity>

            {/* Last Page Button */}
            <TouchableOpacity
              style={{
                backgroundColor: currentPage === totalPages ? COLORS.lightgray : COLORS.green,
                borderRadius: 6,
                padding: 8,
                opacity: currentPage === totalPages ? 0.5 : 1,
              }}
              onPress={handleLastPage}
              disabled={currentPage === totalPages}
            >
              <Feather
                name='chevrons-right'
                size={16}
                color={currentPage === totalPages ? COLORS.gray : COLORS.white}
              />
            </TouchableOpacity>
          </View>
        </View>
      )}
    </View>
  );
}

const SkeletonError = ({ error }: { error: Error | null }) => {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.white,
        padding: 16,
        borderRadius: 8,
        marginBottom: 12,
      }}
    >
      <Feather name='alert-circle' size={24} color={COLORS.red} />
      <Text>Erro ao buscar aplicações</Text>
      <Text>{error?.message}</Text>
    </View>
  );
};

const SkeletonLoading = () => {
  return (
    <View
      style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: COLORS.background,
        padding: 16,
        borderRadius: 8,
      }}
    >
      <ActivityIndicator size='large' color={COLORS.primary} />
    </View>
  );
};
